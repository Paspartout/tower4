#include <stdint.h>
#include <math.h>
#include <assert.h>

#include "sokol_app.h"
#include "sokol_gfx.h"
#include "sokol_time.h"
#include "sokol_glue.h"
#include "sokol_shape.h"
#include "sokol_audio.h"

#ifdef ENABLE_IMGUI
#define CIMGUI_DEFINE_ENUMS_AND_STRUCTS
#include "cimgui.h"
#include "sokol_imgui.h"
#endif

#define HANDMADE_MATH_IMPLEMENTATION
// TODO: Enable SSE on non WEBGL Builds
#define HANDMADE_MATH_NO_SSE
#include "HandmadeMath.h"

#include "shader/shapes.glsl.h"

#define N_PARTICLES 4096
const float particle_size = 64.0f;
static struct {
	sg_pipeline pip;
	sg_bindings bind;
	sg_pass_action pass_action;
    sshape_element_range_t elms;

	uint64_t laptime;
	struct {
		bool show_synth;
	} ui;

    vs_params_t vs_params;
    float rx, ry;
} state;


static void init(void)
{
	sg_setup(&(sg_desc){.context = sapp_sgcontext()});
	stm_setup();
	saudio_setup(&(saudio_desc){});

#ifdef ENABLE_IMGUI
	simgui_setup(&(simgui_desc_t){0});
	ImGuiIO *io = igGetIO();
	io->FontGlobalScale = 2.0f;
#endif

	sg_shader shader = sg_make_shader(shapes_shader_desc(sg_query_backend()));

	state.pass_action = (sg_pass_action) {
		.colors[0] = { .action = SG_ACTION_CLEAR, .value = {0.0f, 0.0f, 0.0f, 1.0f}}
	};

	state.pip = sg_make_pipeline(&(sg_pipeline_desc) {
		.shader = shader,
		.layout = {
			.buffers[0] = sshape_buffer_layout_desc(),
			.attrs = {
                [0] = sshape_position_attr_desc(),
                [1] = sshape_normal_attr_desc(),
                [2] = sshape_texcoord_attr_desc(),
                [3] = sshape_color_attr_desc()
			}
		},
        .index_type = SG_INDEXTYPE_UINT16,
        .cull_mode = SG_CULLMODE_NONE,
        .depth = {
            .compare = SG_COMPAREFUNC_LESS_EQUAL,
            .write_enabled = true
        },
	});

    // generate merged shape geometries
    sshape_vertex_t vertices[6 * 1024];
    uint16_t indices[16 * 1024];
    sshape_buffer_t buf = {
        .vertices.buffer = SSHAPE_RANGE(vertices),
        .indices.buffer  = SSHAPE_RANGE(indices),
    };

    const hmm_mat4 box_transform = HMM_Translate(HMM_Vec3(0.0f, -1.5f, 0.0f));
	buf = sshape_build_box(&buf, &(sshape_box_t){
		.width = 1.0f,
		.height = 0.1f,
		.depth = 1.0f,
		.tiles = 1,
		.transform = sshape_mat4(&box_transform.Elements[0][0])
	});

    const hmm_mat4 cylinder_transform = HMM_Translate(HMM_Vec3(0.0f, 0.0f, 0.0f));
	buf = sshape_build_cylinder(&buf, &(sshape_cylinder_t){
		.merge = true,
        .radius = 0.5f,
        .height = 3.0f,
        .slices = 8,
        .stacks = 3,
		.transform = sshape_mat4(&cylinder_transform.Elements[0][0])
	});

    const hmm_mat4 box_transform2 = HMM_Translate(HMM_Vec3(0.0f, 1.5f, 0.0f));
	buf = sshape_build_box(&buf, &(sshape_box_t){
		.merge = true,
		.width = 1.0f,
		.height = 0.1f,
		.depth = 1.0f,
		.tiles = 1,
		.transform = sshape_mat4(&box_transform2.Elements[0][0])
	});


    assert(buf.valid);

    // extract element range for sg_draw()
	// TODO: Undestand element vs index
    state.elms = sshape_element_range(&buf);
    const sg_buffer_desc vbuf_desc = sshape_vertex_buffer_desc(&buf);
    const sg_buffer_desc ibuf_desc = sshape_index_buffer_desc(&buf);
    state.bind.vertex_buffers[0] = sg_make_buffer(&vbuf_desc);
    state.bind.index_buffer = sg_make_buffer(&ibuf_desc);

	// ui
	state.ui.show_synth = true;
}

static uint64_t render_duration;

static int audio_index = 0;
static float amplitude = 0.2;
static float freq = 440.0;
static float mfreq = 440.0;
static float freqfreq = 1.0;
static float decay = 0.05f;
static float audio_frames[2048*16];
static bool audio_is_playing = false;

static void frame(void)
{
	const int width = sapp_width();
	const int height = sapp_height();
	const double delta_time = stm_sec(stm_round_to_common_refresh_rate(stm_laptime(&state.laptime)));

#ifdef ENABLE_IMGUI
	// Show UI if enabled
	simgui_new_frame(width, height, delta_time);
	if (state.ui.show_synth) {
		igSetNextWindowPos((ImVec2){10, 10}, ImGuiCond_Once, (ImVec2){0, 0});
		igSetNextWindowSize((ImVec2){400, 600}, ImGuiCond_Once);
		igBegin("Synth", &state.ui.show_synth, ImGuiWindowFlags_None);
		igCheckbox("Enable", &audio_is_playing);
		igSliderFloat("amplitude", &amplitude, 0, 1, "%f", ImGuiSliderFlags_None);
		igSliderFloat("freq", &freq, 0, 2000, "%f", ImGuiSliderFlags_None);
		igSliderFloat("mfreq", &mfreq, 0, 2000, "%f", ImGuiSliderFlags_None);
		igSliderFloat("freqfreq", &freqfreq, 0, 10, "%f", ImGuiSliderFlags_None);
		igSliderFloat("decay", &decay, 0, 1, "%f", ImGuiSliderFlags_None);
		// TODO: Propper ringbuffer for plotting the waveforms?
		// igPlotLinesFloatPtr("buffer", audio_frames, 2048, 0, "", -1.0 , 1.0, (ImVec2){200, 200}, 0);
		igEnd();
	}
#endif

	// TODO: Refactor
	const int num_frames = saudio_expect();
	static bool scnd_buf = false;
	if (audio_is_playing && num_frames > 0) {
		const int num_samples = num_frames * saudio_channels();
		for (int i = 0; i < num_samples; i++) {
			const float t = (float)audio_index / 44100.0f;
			//audio_frames[i] = amplitude * sin((float)audio_index/44100.0 * freq *  M_PI * 2);
			freq = mfreq * sin(t * freqfreq);
			audio_frames[scnd_buf ? i+2048 : i] = amplitude * sin(freq * M_PI * 2);
			audio_index++;
		}

		// Echo
		const int decay_sampels = 1024;
		for (int i = 0; i < 2048; i++)
		{
			// WARNING: overflow potential
			if (scnd_buf) {
				audio_frames[i + 2048] += audio_frames[i] * decay;
			} else {
				audio_frames[i] += audio_frames[i + 2048] * decay;
			}
		}

		saudio_push(&audio_frames[scnd_buf ? 2048 : 0], num_samples);
		scnd_buf = !scnd_buf;
	}


	// Render current state of game/simulation
	uint64_t now = stm_now();
	/* update instance data */

	sg_begin_default_pass(&state.pass_action, width, height);
	sg_apply_pipeline(state.pip);
	sg_apply_bindings(&state.bind);

	// Render shapes
    // build model-view-projection matrix

    state.rx += 1.0f;
    state.ry += 2.0f;
    hmm_mat4 proj = HMM_Perspective(60.0f, sapp_widthf()/sapp_heightf(), 0.01f, 10.0f);
    hmm_mat4 view = HMM_LookAt(HMM_Vec3(0.0f, 1.5f, 6.0f), HMM_Vec3(0.0f, 0.0f, 0.0f), HMM_Vec3(0.0f, 1.0f, 0.0f));
    hmm_mat4 view_proj = HMM_MultiplyMat4(proj, view);
    hmm_mat4 rxm = HMM_Rotate(state.rx, HMM_Vec3(1.0f, 0.0f, 0.0f));
    hmm_mat4 rym = HMM_Rotate(state.ry, HMM_Vec3(0.0f, 1.0f, 0.0f));
    hmm_mat4 model = HMM_MultiplyMat4(rxm, rym);
    state.vs_params.mvp = HMM_MultiplyMat4(view_proj, model);

	sg_apply_uniforms(SG_SHADERSTAGE_VS, SLOT_vs_params, &SG_RANGE(state.vs_params));
	sg_draw(state.elms.base_element, state.elms.num_elements, N_PARTICLES);

#ifdef ENABLE_IMGUI
	simgui_render();
#endif
	sg_end_pass();
	sg_commit();
	render_duration = stm_since(now);
}

static void cleanup(void)
{
	saudio_shutdown();
#ifdef ENABLE_IMGUI
	simgui_shutdown();
#endif
	sg_shutdown();
}

#define TOGGLE(property) do { property = !property; } while(0)

static void event(const sapp_event *ev)
{
	if (ev->type == SAPP_EVENTTYPE_RESIZED) {
		//vs_params.proj = HMM_Orthographic(0.0f, sapp_width(), sapp_height(), 0.0f, -1.0f, 1.0f);
	}
	if (ev->type == SAPP_EVENTTYPE_KEY_DOWN) {
		switch (ev->key_code) {
		case SAPP_KEYCODE_F1:
			TOGGLE(state.ui.show_synth);
			break;
		case SAPP_KEYCODE_F11:
			sapp_toggle_fullscreen();
			break;
		case SAPP_KEYCODE_ESCAPE:
			if (sapp_is_fullscreen()) {
				sapp_toggle_fullscreen();
			} else {
#if !defined(__EMSCRIPTEN__)
				sapp_request_quit();
#endif
			}
			break;
		default:
			break;
		}
	}
#ifdef ENABLE_IMGUI
	simgui_handle_event(ev);
#endif
}

sapp_desc sokol_main(int argc, char *argv[])
{
	(void)argc;
	(void)argv;
	return (sapp_desc){
	    .init_cb = init,
	    .frame_cb = frame,
	    .cleanup_cb = cleanup,
	    .event_cb = event,
	    .window_title = "Tower4",
	    .high_dpi = true,
	    .width = 1920,
	    .height = 1080,
	};
}
