#pragma once
/*
    #version:1# (machine generated, don't edit!)

    Generated by sokol-shdc (https://github.com/floooh/sokol-tools)

    Cmdline: sokol-shdc --slang glsl330:glsl100:glsl300es -i /home/paspartout/dev/pro/games/tower4/src/shader/shapes.glsl -o /home/paspartout/dev/pro/games/tower4/src/shader/shapes.glsl.h

    Overview:

        Shader program 'shapes':
            Get shader desc: shapes_shader_desc(sg_query_backend());
            Vertex shader: vs
                Attribute slots:
                    ATTR_vs_position = 0
                    ATTR_vs_normal = 1
                Uniform block 'vs_params':
                    C struct: vs_params_t
                    Bind slot: SLOT_vs_params = 0
            Fragment shader: fs


    Shader descriptor structs:

        sg_shader shapes = sg_make_shader(shapes_shader_desc(sg_query_backend()));

    Vertex attribute locations for vertex shader 'vs':

        sg_pipeline pip = sg_make_pipeline(&(sg_pipeline_desc){
            .layout = {
                .attrs = {
                    [ATTR_vs_position] = { ... },
                    [ATTR_vs_normal] = { ... },
                },
            },
            ...});

    Image bind slots, use as index in sg_bindings.vs_images[] or .fs_images[]


    Bind slot and C-struct for uniform block 'vs_params':

        vs_params_t vs_params = {
            .draw_mode = ...;
            .mvp = ...;
        };
        sg_apply_uniforms(SG_SHADERSTAGE_[VS|FS], SLOT_vs_params, &SG_RANGE(vs_params));

*/
#include <stdint.h>
#include <stdbool.h>
#if !defined(SOKOL_SHDC_ALIGN)
  #if defined(_MSC_VER)
    #define SOKOL_SHDC_ALIGN(a) __declspec(align(a))
  #else
    #define SOKOL_SHDC_ALIGN(a) __attribute__((aligned(a)))
  #endif
#endif
#define ATTR_vs_position (0)
#define ATTR_vs_normal (1)
#define SLOT_vs_params (0)
#pragma pack(push,1)
SOKOL_SHDC_ALIGN(16) typedef struct vs_params_t {
    float draw_mode;
    uint8_t _pad_4[12];
    hmm_mat4 mvp;
} vs_params_t;
#pragma pack(pop)
/*
    #version 330
    
    uniform vec4 vs_params[5];
    layout(location = 0) in vec4 position;
    out vec4 color;
    layout(location = 1) in vec3 normal;
    
    void main()
    {
        gl_Position = mat4(vs_params[1], vs_params[2], vs_params[3], vs_params[4]) * position;
        color = vec4((normal + vec3(1.0)) * 0.5, 1.0);
    }
    
*/
static const char vs_source_glsl330[294] = {
    0x23,0x76,0x65,0x72,0x73,0x69,0x6f,0x6e,0x20,0x33,0x33,0x30,0x0a,0x0a,0x75,0x6e,
    0x69,0x66,0x6f,0x72,0x6d,0x20,0x76,0x65,0x63,0x34,0x20,0x76,0x73,0x5f,0x70,0x61,
    0x72,0x61,0x6d,0x73,0x5b,0x35,0x5d,0x3b,0x0a,0x6c,0x61,0x79,0x6f,0x75,0x74,0x28,
    0x6c,0x6f,0x63,0x61,0x74,0x69,0x6f,0x6e,0x20,0x3d,0x20,0x30,0x29,0x20,0x69,0x6e,
    0x20,0x76,0x65,0x63,0x34,0x20,0x70,0x6f,0x73,0x69,0x74,0x69,0x6f,0x6e,0x3b,0x0a,
    0x6f,0x75,0x74,0x20,0x76,0x65,0x63,0x34,0x20,0x63,0x6f,0x6c,0x6f,0x72,0x3b,0x0a,
    0x6c,0x61,0x79,0x6f,0x75,0x74,0x28,0x6c,0x6f,0x63,0x61,0x74,0x69,0x6f,0x6e,0x20,
    0x3d,0x20,0x31,0x29,0x20,0x69,0x6e,0x20,0x76,0x65,0x63,0x33,0x20,0x6e,0x6f,0x72,
    0x6d,0x61,0x6c,0x3b,0x0a,0x0a,0x76,0x6f,0x69,0x64,0x20,0x6d,0x61,0x69,0x6e,0x28,
    0x29,0x0a,0x7b,0x0a,0x20,0x20,0x20,0x20,0x67,0x6c,0x5f,0x50,0x6f,0x73,0x69,0x74,
    0x69,0x6f,0x6e,0x20,0x3d,0x20,0x6d,0x61,0x74,0x34,0x28,0x76,0x73,0x5f,0x70,0x61,
    0x72,0x61,0x6d,0x73,0x5b,0x31,0x5d,0x2c,0x20,0x76,0x73,0x5f,0x70,0x61,0x72,0x61,
    0x6d,0x73,0x5b,0x32,0x5d,0x2c,0x20,0x76,0x73,0x5f,0x70,0x61,0x72,0x61,0x6d,0x73,
    0x5b,0x33,0x5d,0x2c,0x20,0x76,0x73,0x5f,0x70,0x61,0x72,0x61,0x6d,0x73,0x5b,0x34,
    0x5d,0x29,0x20,0x2a,0x20,0x70,0x6f,0x73,0x69,0x74,0x69,0x6f,0x6e,0x3b,0x0a,0x20,
    0x20,0x20,0x20,0x63,0x6f,0x6c,0x6f,0x72,0x20,0x3d,0x20,0x76,0x65,0x63,0x34,0x28,
    0x28,0x6e,0x6f,0x72,0x6d,0x61,0x6c,0x20,0x2b,0x20,0x76,0x65,0x63,0x33,0x28,0x31,
    0x2e,0x30,0x29,0x29,0x20,0x2a,0x20,0x30,0x2e,0x35,0x2c,0x20,0x31,0x2e,0x30,0x29,
    0x3b,0x0a,0x7d,0x0a,0x0a,0x00,
};
/*
    #version 330
    
    layout(location = 0) out vec4 frag_color;
    in vec4 color;
    
    void main()
    {
        frag_color = color;
    }
    
*/
static const char fs_source_glsl330[114] = {
    0x23,0x76,0x65,0x72,0x73,0x69,0x6f,0x6e,0x20,0x33,0x33,0x30,0x0a,0x0a,0x6c,0x61,
    0x79,0x6f,0x75,0x74,0x28,0x6c,0x6f,0x63,0x61,0x74,0x69,0x6f,0x6e,0x20,0x3d,0x20,
    0x30,0x29,0x20,0x6f,0x75,0x74,0x20,0x76,0x65,0x63,0x34,0x20,0x66,0x72,0x61,0x67,
    0x5f,0x63,0x6f,0x6c,0x6f,0x72,0x3b,0x0a,0x69,0x6e,0x20,0x76,0x65,0x63,0x34,0x20,
    0x63,0x6f,0x6c,0x6f,0x72,0x3b,0x0a,0x0a,0x76,0x6f,0x69,0x64,0x20,0x6d,0x61,0x69,
    0x6e,0x28,0x29,0x0a,0x7b,0x0a,0x20,0x20,0x20,0x20,0x66,0x72,0x61,0x67,0x5f,0x63,
    0x6f,0x6c,0x6f,0x72,0x20,0x3d,0x20,0x63,0x6f,0x6c,0x6f,0x72,0x3b,0x0a,0x7d,0x0a,
    0x0a,0x00,
};
/*
    #version 100
    
    uniform vec4 vs_params[5];
    attribute vec4 position;
    varying vec4 color;
    attribute vec3 normal;
    
    void main()
    {
        gl_Position = mat4(vs_params[1], vs_params[2], vs_params[3], vs_params[4]) * position;
        color = vec4((normal + vec3(1.0)) * 0.5, 1.0);
    }
    
*/
static const char vs_source_glsl100[270] = {
    0x23,0x76,0x65,0x72,0x73,0x69,0x6f,0x6e,0x20,0x31,0x30,0x30,0x0a,0x0a,0x75,0x6e,
    0x69,0x66,0x6f,0x72,0x6d,0x20,0x76,0x65,0x63,0x34,0x20,0x76,0x73,0x5f,0x70,0x61,
    0x72,0x61,0x6d,0x73,0x5b,0x35,0x5d,0x3b,0x0a,0x61,0x74,0x74,0x72,0x69,0x62,0x75,
    0x74,0x65,0x20,0x76,0x65,0x63,0x34,0x20,0x70,0x6f,0x73,0x69,0x74,0x69,0x6f,0x6e,
    0x3b,0x0a,0x76,0x61,0x72,0x79,0x69,0x6e,0x67,0x20,0x76,0x65,0x63,0x34,0x20,0x63,
    0x6f,0x6c,0x6f,0x72,0x3b,0x0a,0x61,0x74,0x74,0x72,0x69,0x62,0x75,0x74,0x65,0x20,
    0x76,0x65,0x63,0x33,0x20,0x6e,0x6f,0x72,0x6d,0x61,0x6c,0x3b,0x0a,0x0a,0x76,0x6f,
    0x69,0x64,0x20,0x6d,0x61,0x69,0x6e,0x28,0x29,0x0a,0x7b,0x0a,0x20,0x20,0x20,0x20,
    0x67,0x6c,0x5f,0x50,0x6f,0x73,0x69,0x74,0x69,0x6f,0x6e,0x20,0x3d,0x20,0x6d,0x61,
    0x74,0x34,0x28,0x76,0x73,0x5f,0x70,0x61,0x72,0x61,0x6d,0x73,0x5b,0x31,0x5d,0x2c,
    0x20,0x76,0x73,0x5f,0x70,0x61,0x72,0x61,0x6d,0x73,0x5b,0x32,0x5d,0x2c,0x20,0x76,
    0x73,0x5f,0x70,0x61,0x72,0x61,0x6d,0x73,0x5b,0x33,0x5d,0x2c,0x20,0x76,0x73,0x5f,
    0x70,0x61,0x72,0x61,0x6d,0x73,0x5b,0x34,0x5d,0x29,0x20,0x2a,0x20,0x70,0x6f,0x73,
    0x69,0x74,0x69,0x6f,0x6e,0x3b,0x0a,0x20,0x20,0x20,0x20,0x63,0x6f,0x6c,0x6f,0x72,
    0x20,0x3d,0x20,0x76,0x65,0x63,0x34,0x28,0x28,0x6e,0x6f,0x72,0x6d,0x61,0x6c,0x20,
    0x2b,0x20,0x76,0x65,0x63,0x33,0x28,0x31,0x2e,0x30,0x29,0x29,0x20,0x2a,0x20,0x30,
    0x2e,0x35,0x2c,0x20,0x31,0x2e,0x30,0x29,0x3b,0x0a,0x7d,0x0a,0x0a,0x00,
};
/*
    #version 100
    precision mediump float;
    precision highp int;
    
    varying highp vec4 color;
    
    void main()
    {
        gl_FragData[0] = color;
    }
    
*/
static const char fs_source_glsl100[133] = {
    0x23,0x76,0x65,0x72,0x73,0x69,0x6f,0x6e,0x20,0x31,0x30,0x30,0x0a,0x70,0x72,0x65,
    0x63,0x69,0x73,0x69,0x6f,0x6e,0x20,0x6d,0x65,0x64,0x69,0x75,0x6d,0x70,0x20,0x66,
    0x6c,0x6f,0x61,0x74,0x3b,0x0a,0x70,0x72,0x65,0x63,0x69,0x73,0x69,0x6f,0x6e,0x20,
    0x68,0x69,0x67,0x68,0x70,0x20,0x69,0x6e,0x74,0x3b,0x0a,0x0a,0x76,0x61,0x72,0x79,
    0x69,0x6e,0x67,0x20,0x68,0x69,0x67,0x68,0x70,0x20,0x76,0x65,0x63,0x34,0x20,0x63,
    0x6f,0x6c,0x6f,0x72,0x3b,0x0a,0x0a,0x76,0x6f,0x69,0x64,0x20,0x6d,0x61,0x69,0x6e,
    0x28,0x29,0x0a,0x7b,0x0a,0x20,0x20,0x20,0x20,0x67,0x6c,0x5f,0x46,0x72,0x61,0x67,
    0x44,0x61,0x74,0x61,0x5b,0x30,0x5d,0x20,0x3d,0x20,0x63,0x6f,0x6c,0x6f,0x72,0x3b,
    0x0a,0x7d,0x0a,0x0a,0x00,
};
/*
    #version 300 es
    
    uniform vec4 vs_params[5];
    layout(location = 0) in vec4 position;
    out vec4 color;
    layout(location = 1) in vec3 normal;
    
    void main()
    {
        gl_Position = mat4(vs_params[1], vs_params[2], vs_params[3], vs_params[4]) * position;
        color = vec4((normal + vec3(1.0)) * 0.5, 1.0);
    }
    
*/
static const char vs_source_glsl300es[297] = {
    0x23,0x76,0x65,0x72,0x73,0x69,0x6f,0x6e,0x20,0x33,0x30,0x30,0x20,0x65,0x73,0x0a,
    0x0a,0x75,0x6e,0x69,0x66,0x6f,0x72,0x6d,0x20,0x76,0x65,0x63,0x34,0x20,0x76,0x73,
    0x5f,0x70,0x61,0x72,0x61,0x6d,0x73,0x5b,0x35,0x5d,0x3b,0x0a,0x6c,0x61,0x79,0x6f,
    0x75,0x74,0x28,0x6c,0x6f,0x63,0x61,0x74,0x69,0x6f,0x6e,0x20,0x3d,0x20,0x30,0x29,
    0x20,0x69,0x6e,0x20,0x76,0x65,0x63,0x34,0x20,0x70,0x6f,0x73,0x69,0x74,0x69,0x6f,
    0x6e,0x3b,0x0a,0x6f,0x75,0x74,0x20,0x76,0x65,0x63,0x34,0x20,0x63,0x6f,0x6c,0x6f,
    0x72,0x3b,0x0a,0x6c,0x61,0x79,0x6f,0x75,0x74,0x28,0x6c,0x6f,0x63,0x61,0x74,0x69,
    0x6f,0x6e,0x20,0x3d,0x20,0x31,0x29,0x20,0x69,0x6e,0x20,0x76,0x65,0x63,0x33,0x20,
    0x6e,0x6f,0x72,0x6d,0x61,0x6c,0x3b,0x0a,0x0a,0x76,0x6f,0x69,0x64,0x20,0x6d,0x61,
    0x69,0x6e,0x28,0x29,0x0a,0x7b,0x0a,0x20,0x20,0x20,0x20,0x67,0x6c,0x5f,0x50,0x6f,
    0x73,0x69,0x74,0x69,0x6f,0x6e,0x20,0x3d,0x20,0x6d,0x61,0x74,0x34,0x28,0x76,0x73,
    0x5f,0x70,0x61,0x72,0x61,0x6d,0x73,0x5b,0x31,0x5d,0x2c,0x20,0x76,0x73,0x5f,0x70,
    0x61,0x72,0x61,0x6d,0x73,0x5b,0x32,0x5d,0x2c,0x20,0x76,0x73,0x5f,0x70,0x61,0x72,
    0x61,0x6d,0x73,0x5b,0x33,0x5d,0x2c,0x20,0x76,0x73,0x5f,0x70,0x61,0x72,0x61,0x6d,
    0x73,0x5b,0x34,0x5d,0x29,0x20,0x2a,0x20,0x70,0x6f,0x73,0x69,0x74,0x69,0x6f,0x6e,
    0x3b,0x0a,0x20,0x20,0x20,0x20,0x63,0x6f,0x6c,0x6f,0x72,0x20,0x3d,0x20,0x76,0x65,
    0x63,0x34,0x28,0x28,0x6e,0x6f,0x72,0x6d,0x61,0x6c,0x20,0x2b,0x20,0x76,0x65,0x63,
    0x33,0x28,0x31,0x2e,0x30,0x29,0x29,0x20,0x2a,0x20,0x30,0x2e,0x35,0x2c,0x20,0x31,
    0x2e,0x30,0x29,0x3b,0x0a,0x7d,0x0a,0x0a,0x00,
};
/*
    #version 300 es
    precision mediump float;
    precision highp int;
    
    layout(location = 0) out highp vec4 frag_color;
    in highp vec4 color;
    
    void main()
    {
        frag_color = color;
    }
    
*/
static const char fs_source_glsl300es[175] = {
    0x23,0x76,0x65,0x72,0x73,0x69,0x6f,0x6e,0x20,0x33,0x30,0x30,0x20,0x65,0x73,0x0a,
    0x70,0x72,0x65,0x63,0x69,0x73,0x69,0x6f,0x6e,0x20,0x6d,0x65,0x64,0x69,0x75,0x6d,
    0x70,0x20,0x66,0x6c,0x6f,0x61,0x74,0x3b,0x0a,0x70,0x72,0x65,0x63,0x69,0x73,0x69,
    0x6f,0x6e,0x20,0x68,0x69,0x67,0x68,0x70,0x20,0x69,0x6e,0x74,0x3b,0x0a,0x0a,0x6c,
    0x61,0x79,0x6f,0x75,0x74,0x28,0x6c,0x6f,0x63,0x61,0x74,0x69,0x6f,0x6e,0x20,0x3d,
    0x20,0x30,0x29,0x20,0x6f,0x75,0x74,0x20,0x68,0x69,0x67,0x68,0x70,0x20,0x76,0x65,
    0x63,0x34,0x20,0x66,0x72,0x61,0x67,0x5f,0x63,0x6f,0x6c,0x6f,0x72,0x3b,0x0a,0x69,
    0x6e,0x20,0x68,0x69,0x67,0x68,0x70,0x20,0x76,0x65,0x63,0x34,0x20,0x63,0x6f,0x6c,
    0x6f,0x72,0x3b,0x0a,0x0a,0x76,0x6f,0x69,0x64,0x20,0x6d,0x61,0x69,0x6e,0x28,0x29,
    0x0a,0x7b,0x0a,0x20,0x20,0x20,0x20,0x66,0x72,0x61,0x67,0x5f,0x63,0x6f,0x6c,0x6f,
    0x72,0x20,0x3d,0x20,0x63,0x6f,0x6c,0x6f,0x72,0x3b,0x0a,0x7d,0x0a,0x0a,0x00,
};
#if !defined(SOKOL_GFX_INCLUDED)
  #error "Please include sokol_gfx.h before shapes.glsl.h"
#endif
static inline const sg_shader_desc* shapes_shader_desc(sg_backend backend) {
  if (backend == SG_BACKEND_GLCORE33) {
    static sg_shader_desc desc;
    static bool valid;
    if (!valid) {
      valid = true;
      desc.attrs[0].name = "position";
      desc.attrs[1].name = "normal";
      desc.vs.source = vs_source_glsl330;
      desc.vs.entry = "main";
      desc.vs.uniform_blocks[0].size = 80;
      desc.vs.uniform_blocks[0].uniforms[0].name = "vs_params";
      desc.vs.uniform_blocks[0].uniforms[0].type = SG_UNIFORMTYPE_FLOAT4;
      desc.vs.uniform_blocks[0].uniforms[0].array_count = 5;
      desc.fs.source = fs_source_glsl330;
      desc.fs.entry = "main";
      desc.label = "shapes_shader";
    };
    return &desc;
  }
  if (backend == SG_BACKEND_GLES2) {
    static sg_shader_desc desc;
    static bool valid;
    if (!valid) {
      valid = true;
      desc.attrs[0].name = "position";
      desc.attrs[1].name = "normal";
      desc.vs.source = vs_source_glsl100;
      desc.vs.entry = "main";
      desc.vs.uniform_blocks[0].size = 80;
      desc.vs.uniform_blocks[0].uniforms[0].name = "vs_params";
      desc.vs.uniform_blocks[0].uniforms[0].type = SG_UNIFORMTYPE_FLOAT4;
      desc.vs.uniform_blocks[0].uniforms[0].array_count = 5;
      desc.fs.source = fs_source_glsl100;
      desc.fs.entry = "main";
      desc.label = "shapes_shader";
    };
    return &desc;
  }
  if (backend == SG_BACKEND_GLES3) {
    static sg_shader_desc desc;
    static bool valid;
    if (!valid) {
      valid = true;
      desc.attrs[0].name = "position";
      desc.attrs[1].name = "normal";
      desc.vs.source = vs_source_glsl300es;
      desc.vs.entry = "main";
      desc.vs.uniform_blocks[0].size = 80;
      desc.vs.uniform_blocks[0].uniforms[0].name = "vs_params";
      desc.vs.uniform_blocks[0].uniforms[0].type = SG_UNIFORMTYPE_FLOAT4;
      desc.vs.uniform_blocks[0].uniforms[0].array_count = 5;
      desc.fs.source = fs_source_glsl300es;
      desc.fs.entry = "main";
      desc.label = "shapes_shader";
    };
    return &desc;
  }
  return 0;
}