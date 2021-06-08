#include <stdint.h>
#include <math.h>
#include <assert.h>
#include <string.h>

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

//#include "shader/shapes.glsl.h"
#include "shader/honeycomb.glsl.h"

typedef struct audio_system {
	int sample_index;  /// what sample we are playing/time indexx

	float amplitude; /// volume
	float end_amplitude;
	float freqfreq;
	float freq;
	float mfreq;

	float decay; /// decay for fake reverb
	
	float audio_frames[2048*16]; /// buffer for audio data
	bool is_playing;
} audio_system;

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

	struct camera {
		hmm_vec3 position;
	
		// Points away/opposite from camera direction
		hmm_vec3 direction;
		hmm_vec3 right;
		hmm_vec3 up;

		float pitch;
		float yaw;
	} camera;

	audio_system audio;

	struct {
		bool forward_down;
		bool right_down;
		bool left_down;
		bool back_down;
	} input;

	float movement_speed;
	float mouse_sensitivity;
} state;

static void audio_init(audio_system *sys) {
	sys->sample_index = 0;

	sys->amplitude = 0.5f;
	sys->end_amplitude = 0.5f;

	sys->mfreq = 40.0;
	sys->freq = 30.0;
	sys->freqfreq = 1.5;
	sys->decay = 0.7f;
	sys->is_playing = false;
}


static void audio_play(audio_system *as) {
	// TODO: Refactor
	const int num_frames = saudio_expect();
	static bool scnd_buf = false;
	if (as->is_playing && num_frames > 0) {
		const int num_samples = num_frames * saudio_channels();
		for (int i = 0; i < num_samples; i++) {
			const float t = (float)as->sample_index / 44100.0f;
			//audio_frames[i] = amplitude * sin((float)audio_index/44100.0 * freq *  M_PI * 2);
			as->freq = as->mfreq * sin(t * as->freqfreq);
			float val = as->amplitude * sin(as->freq * M_PI * 2);
			if (val >= 0.5) {
				val = 0.5;
			}
			val *= as->end_amplitude;
			as->audio_frames[scnd_buf ? i+2048 : i] = val;
			as->sample_index++;
		}

		// Echo
		for (int i = 0; i < 2048; i++)
		{
			// WARNING: overflow potential
			if (scnd_buf) {
				as->audio_frames[i + 2048] += as->audio_frames[i] * as->decay;
			} else {
				as->audio_frames[i] += as->audio_frames[i + 2048] * as->decay;
			}
		}

		saudio_push(&as->audio_frames[scnd_buf ? 2048 : 0], num_samples);
		scnd_buf = !scnd_buf;
	}
}

static sshape_buffer_t build_pillar(const sshape_buffer_t *in_buf, const hmm_vec3 translation) {
    const hmm_mat4 box_transform = HMM_Translate(HMM_AddVec3(translation, HMM_Vec3(0.0f, -1.4f, 0.0f)));
    sshape_buffer_t buf = *in_buf;

	buf = sshape_build_box(&buf, &(sshape_box_t){
		.merge = true,
		.width = 1.0f,
		.height = 0.2f,
		.depth = 1.0f,
		.tiles = 1,
		.transform = sshape_mat4(&box_transform.Elements[0][0])
	});

    const hmm_mat4 cylinder_transform = HMM_Translate(HMM_AddVec3(translation, HMM_Vec3(0.0f, 0.0f, 0.0f)));
	buf = sshape_build_cylinder(&buf, &(sshape_cylinder_t){
		.merge = true,
        .radius = 0.45f,
        .height = 3.0f,
        .slices = 10,
        .stacks = 3,
		.transform = sshape_mat4(&cylinder_transform.Elements[0][0])
	});

    const hmm_mat4 box_transform2 = HMM_Translate(HMM_AddVec3(translation, HMM_Vec3(0.0f, 1.4f, 0.0f)));
	buf = sshape_build_box(&buf, &(sshape_box_t){
		.merge = true,
		.width = 1.0f,
		.height = 0.2f,
		.depth = 1.0f,
		.tiles = 1,
		.transform = sshape_mat4(&box_transform2.Elements[0][0])
	});

	return buf;
}


static void build_level(void) {
    // generate merged shape geometries
    sshape_vertex_t vertices[6 * 1024];
    uint16_t indices[16 * 1024];
    sshape_buffer_t buf = {
        .vertices.buffer = SSHAPE_RANGE(vertices),
        .indices.buffer  = SSHAPE_RANGE(indices),
    };

	// Floor
	const hmm_mat4 floor_transform = HMM_Translate(HMM_Vec3(0, -1.5, 4.0));
	buf = sshape_build_plane(&buf, &(sshape_plane_t){
		.width = 10.0f,
		.depth = 10.0f,
		.transform = sshape_mat4(&floor_transform.Elements[0][0])
	});

	// Pillars
	for (int i = 0; i < 5; i++) {
		const float dz = i * 2.0f;
		buf = build_pillar(&buf, HMM_Vec3(2.0f, 0, dz));
		buf = build_pillar(&buf, HMM_Vec3(-2.0f, 0, dz));
	}

	const hmm_mat4 door_tf = HMM_Translate(HMM_Vec3(-0.55f, -0.5f, 0.5f));
	buf = sshape_build_box(&buf, &(sshape_box_t){
		.merge = true,
		.width = 1.0f,
		.height = 2.0f,
		.depth = 0.1f,
		.tiles = 1,
		.transform = sshape_mat4(&door_tf.Elements[0][0])
	});
	const hmm_mat4 door2_tf = HMM_Translate(HMM_Vec3(0.55f, -0.5f, 0.5f));
	buf = sshape_build_box(&buf, &(sshape_box_t){
		.merge = true,
		.width = 1.0f,
		.height = 2.0f,
		.depth = 0.1f,
		.tiles = 1,
		.transform = sshape_mat4(&door2_tf.Elements[0][0])
	});

    assert(buf.valid);

    // extract element range for sg_draw()
    state.elms = sshape_element_range(&buf);
    const sg_buffer_desc vbuf_desc = sshape_vertex_buffer_desc(&buf);
    const sg_buffer_desc ibuf_desc = sshape_index_buffer_desc(&buf);
	// TODO: somehow return this instead of setting state
    state.bind.vertex_buffers[0] = sg_make_buffer(&vbuf_desc);
    state.bind.index_buffer = sg_make_buffer(&ibuf_desc);
}

static void camera_update() {
	const float yaw = HMM_ToRadians(state.camera.yaw);
	const float pitch = HMM_ToRadians(state.camera.pitch);

	const hmm_vec3 dir = HMM_Vec3(cos(yaw) * cos(pitch), sin(pitch), sin(yaw) * cos(pitch));
	state.camera.direction = HMM_NormalizeVec3(dir);
}

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

	sg_shader shader = sg_make_shader(honeycomb_shader_desc(sg_query_backend()));

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
        .cull_mode = SG_CULLMODE_BACK,
        .depth = {
            .compare = SG_COMPAREFUNC_LESS_EQUAL,
            .write_enabled = true
        },
	});

	build_level();

	state.camera.position = (hmm_vec3){ .Z=15.f, .Y=-0.5f };
	state.camera.direction = (hmm_vec3){ .Z=-1.0f };
	state.camera.right = HMM_NormalizeVec3(HMM_Cross((hmm_vec3){ .Y=1.0f }, state.camera.direction));
	state.camera.up = HMM_Cross(state.camera.direction, state.camera.right);

	state.camera.yaw = -90.0f;
	state.camera.pitch = 0.0f;

	state.movement_speed = 0.1f;
	state.mouse_sensitivity = 0.1f;
	camera_update();

	audio_init(&state.audio);
}

static uint64_t render_duration;


static void audio_ui(audio_system* as) {
		igBegin("Synth", &state.ui.show_synth, ImGuiWindowFlags_None);
		igCheckbox("Enable", &as->is_playing);
		igSliderFloat("amplitude", &as->amplitude, 0, 1, "%f", ImGuiSliderFlags_None);
		igSliderFloat("end_amplitude", &as->end_amplitude, 0, 1, "%f", ImGuiSliderFlags_None);
		igSliderFloat("freq", &as->freq, 0, 2000, "%f", ImGuiSliderFlags_None);
		igSliderFloat("mfreq", &as->mfreq, 0, 2000, "%f", ImGuiSliderFlags_None);
		igSliderFloat("freqfreq", &as->freqfreq, 0, 100, "%f", ImGuiSliderFlags_None);
		igSliderFloat("decay", &as->decay, 0, 1, "%f", ImGuiSliderFlags_None);
		// TODO: Propper ringbuffer for plotting the waveforms?
		// igPlotLinesFloatPtr("buffer", audio_frames, 2048, 0, "", -1.0 , 1.0, (ImVec2){200, 200}, 0);
		igEnd();
}



static void frame(void)
{
	uint64_t now = stm_now();
	const int width = sapp_width();
	const int height = sapp_height();
	const double delta_time = stm_sec(stm_round_to_common_refresh_rate(stm_laptime(&state.laptime)));

#ifdef ENABLE_IMGUI
	// Show UI if enabled
	simgui_new_frame(width, height, delta_time);
	if (state.ui.show_synth) {
		igSetNextWindowPos((ImVec2){10, 10}, ImGuiCond_Once, (ImVec2){0, 0});
		igSetNextWindowSize((ImVec2){400, 600}, ImGuiCond_Once);

		audio_ui(&state.audio);
	}

	igBegin("Camera", NULL, ImGuiSliderFlags_None);
	igDragFloat("Camera X", &state.camera.position.X, 0.01f, -20.0f, 20.0f, "%f", ImGuiSliderFlags_None);
	igDragFloat("Camera Y", &state.camera.position.Y, 0.01f, -20.0f, 20.0f, "%f", ImGuiSliderFlags_None);
	igDragFloat("Camera Z", &state.camera.position.Z, 0.01f, -20.0f, 20.0f, "%f", ImGuiSliderFlags_None);
	igValueFloat("Rendering: ", (float)stm_ms(render_duration), "%.2f ms");

	igDragFloat("Speed", &state.movement_speed, 0.001f, 0.0f, 10.0f, "%f", ImGuiSliderFlags_None);
	igDragFloat("Sensitivity", &state.mouse_sensitivity, 0.001f, 0.0f, 1.0f, "%f", ImGuiSliderFlags_None);
	igValueFloat("Pitch: ", state.camera.pitch, "%.2f °");
	igValueFloat("YAW: ", state.camera.yaw, "%.2f °");
	igEnd();
#endif

	hmm_vec3 dir = state.camera.direction;
	if (state.input.forward_down) {
		hmm_vec3 vel = HMM_MultiplyVec3f(dir, state.movement_speed);
		vel.Y = 0;
		state.camera.position = HMM_AddVec3(state.camera.position, vel);
	} else if (state.input.back_down) {
		hmm_vec3 vel = HMM_MultiplyVec3f(dir, state.movement_speed);
		vel.Y = 0;
		state.camera.position = HMM_SubtractVec3(state.camera.position, vel);
	}
	if (state.input.left_down) {
		hmm_vec3 vel = HMM_Cross(dir, state.camera.up);
		vel.Y = 0;
		state.camera.position = HMM_SubtractVec3(state.camera.position, HMM_MultiplyVec3f(HMM_NormalizeVec3(vel), state.movement_speed));
	} else if (state.input.right_down) {
		hmm_vec3 vel = HMM_Cross(dir, state.camera.up);
		vel.Y = 0;
		state.camera.position = HMM_AddVec3(state.camera.position, HMM_MultiplyVec3f(HMM_NormalizeVec3(vel), state.movement_speed));
	}
	camera_update();

	audio_play(&state.audio);

	sg_begin_default_pass(&state.pass_action, width, height);
	sg_apply_pipeline(state.pip);
	sg_apply_bindings(&state.bind);

	// Render shapes
    // build model-view-projection matrix
    hmm_mat4 proj = HMM_Perspective(60.0f, sapp_widthf()/sapp_heightf(), 0.01f, 1000.0f);

    hmm_mat4 view = HMM_LookAt(state.camera.position, HMM_AddVec3(state.camera.position, state.camera.direction), HMM_Vec3(0.0f, 1.0f, 0.0f));
    hmm_mat4 view_proj = HMM_MultiplyMat4(proj, view);
    hmm_mat4 model = HMM_Translate(HMM_Vec3(0.0, 0.0, 0.0));
    
	state.vs_params.mvp = HMM_MultiplyMat4(view_proj, model);

	sg_apply_uniforms(SG_SHADERSTAGE_VS, SLOT_vs_params, &SG_RANGE(state.vs_params));
	sg_draw(state.elms.base_element, state.elms.num_elements, 1);
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
	switch (ev->type) {
		case SAPP_EVENTTYPE_MOUSE_DOWN:
			if (ev->mouse_button == SAPP_MOUSEBUTTON_LEFT) {
				#ifdef ENABLE_IMGUI
				const bool imgui_clicked = igGetIO()->WantCaptureMouse;
				#else
				const bool imgui_clicked = false;
				#endif
				if (!imgui_clicked && !sapp_mouse_locked()) {
					sapp_lock_mouse(true);
				}
			}
			break;
		case SAPP_EVENTTYPE_MOUSE_MOVE:
			if (sapp_mouse_locked()) {
				// TODO: Refactor into it's own function
				const float dx = ev->mouse_dx * state.mouse_sensitivity;
				const float dy = ev->mouse_dy * state.mouse_sensitivity;

				state.camera.yaw += dx;
				state.camera.pitch -= dy;

				if(state.camera.pitch > 89.0f)
					state.camera.pitch = 89.0f;
				if(state.camera.pitch < -89.0f)
					state.camera.pitch = -89.0f;
			}
			break;

		case SAPP_EVENTTYPE_KEY_DOWN:
			switch (ev->key_code) {
			case SAPP_KEYCODE_W:
				state.input.forward_down = true;
				break;
			case SAPP_KEYCODE_A:
				state.input.left_down = true;
				break;
			case SAPP_KEYCODE_S:
				state.input.back_down = true;
				break;
			case SAPP_KEYCODE_D:
				state.input.right_down = true;
				break;
			case SAPP_KEYCODE_F1:
				TOGGLE(state.ui.show_synth);
				break;
			case SAPP_KEYCODE_F11:
				sapp_toggle_fullscreen();
				break;
			case SAPP_KEYCODE_ESCAPE:
				if (sapp_is_fullscreen()) {
					sapp_toggle_fullscreen();
				} else if (sapp_mouse_locked()) {
					sapp_lock_mouse(false);
				} else {
	#if !defined(__EMSCRIPTEN__)
					sapp_request_quit();
	#endif
				}
				break;
			default:
				break;
			}
			break;

		case SAPP_EVENTTYPE_KEY_UP:
			switch (ev->key_code) {
			case SAPP_KEYCODE_W:
				state.input.forward_down = false;
				break;
			case SAPP_KEYCODE_A:
				state.input.left_down = false;
				break;
			case SAPP_KEYCODE_S:
				state.input.back_down = false;
				break;
			case SAPP_KEYCODE_D:
				state.input.right_down = false;
				break;
			default:
				break;
			}
			break;
		default:
			break;
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
