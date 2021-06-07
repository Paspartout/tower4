@ctype mat4 hmm_mat4

@vs vs
uniform vs_params {
    mat4 mvp;
};

layout(location=0) in vec4 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec2 texcoord;
//layout(location=3) in vec4 color0;

out vec2 uv;

void main() {
    gl_Position = mvp * position;
    uv = texcoord;
}
@end


@fs fs

float rand(vec2 x) {
    return fract(cos(mod(dot(x, vec2(13.9898, 8.141)), 3.14)) * 43758.5453);
}

vec2 rand2(vec2 x) {
    return fract(cos(mod(vec2(dot(x, vec2(13.9898, 8.141)),
						      dot(x, vec2(3.4562, 17.398))), vec2(3.14))) * 43758.5453);
}

vec3 rand3(vec2 x) {
    return fract(cos(mod(vec3(dot(x, vec2(13.9898, 8.141)),
							  dot(x, vec2(3.4562, 17.398)),
                              dot(x, vec2(13.254, 5.867))), vec3(3.14))) * 43758.5453);
}

vec3 rgb2hsv(vec3 c) {
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = c.g < c.b ? vec4(c.bg, K.wz) : vec4(c.gb, K.xy);
	vec4 q = c.r < p.x ? vec4(p.xyw, c.r) : vec4(c.r, p.yzx);

	float d = q.x - min(q.w, q.y);
	float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float beehive_dist(vec2 p){
	vec2 s = vec2(1.0, 1.73205080757);
    p = abs(p);
    return max(dot(p, s*.5), p.x);
}

vec4 beehive_center(vec2 p) {
	vec2 s = vec2(1.0, 1.73205080757);
    vec4 hC = floor(vec4(p, p - vec2(.5, 1))/vec4(s,s)) + .5;
    vec4 h = vec4(p - hC.xy*s, p - (hC.zw + .5)*s);
    return dot(h.xy, h.xy)<dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + 9.73);
}
vec3 blend_normal(vec2 uv, vec3 c1, vec3 c2, float opacity) {
	return opacity*c1 + (1.0-opacity)*c2;
}

vec3 blend_dissolve(vec2 uv, vec3 c1, vec3 c2, float opacity) {
	if (rand(uv) < opacity) {
		return c1;
	} else {
		return c2;
	}
}

vec3 blend_multiply(vec2 uv, vec3 c1, vec3 c2, float opacity) {
	return opacity*c1*c2 + (1.0-opacity)*c2;
}

vec3 blend_screen(vec2 uv, vec3 c1, vec3 c2, float opacity) {
	return opacity*(1.0-(1.0-c1)*(1.0-c2)) + (1.0-opacity)*c2;
}

float blend_overlay_f(float c1, float c2) {
	return (c1 < 0.5) ? (2.0*c1*c2) : (1.0-2.0*(1.0-c1)*(1.0-c2));
}

vec3 blend_overlay(vec2 uv, vec3 c1, vec3 c2, float opacity) {
	return opacity*vec3(blend_overlay_f(c1.x, c2.x), blend_overlay_f(c1.y, c2.y), blend_overlay_f(c1.z, c2.z)) + (1.0-opacity)*c2;
}

vec3 blend_hard_light(vec2 uv, vec3 c1, vec3 c2, float opacity) {
	return opacity*0.5*(c1*c2+blend_overlay(uv, c1, c2, 1.0)) + (1.0-opacity)*c2;
}

float blend_soft_light_f(float c1, float c2) {
	return (c2 < 0.5) ? (2.0*c1*c2+c1*c1*(1.0-2.0*c2)) : 2.0*c1*(1.0-c2)+sqrt(c1)*(2.0*c2-1.0);
}

vec3 blend_soft_light(vec2 uv, vec3 c1, vec3 c2, float opacity) {
	return opacity*vec3(blend_soft_light_f(c1.x, c2.x), blend_soft_light_f(c1.y, c2.y), blend_soft_light_f(c1.z, c2.z)) + (1.0-opacity)*c2;
}

float blend_burn_f(float c1, float c2) {
	return (c1==0.0)?c1:max((1.0-((1.0-c2)/c1)),0.0);
}

vec3 blend_burn(vec2 uv, vec3 c1, vec3 c2, float opacity) {
	return opacity*vec3(blend_burn_f(c1.x, c2.x), blend_burn_f(c1.y, c2.y), blend_burn_f(c1.z, c2.z)) + (1.0-opacity)*c2;
}

float blend_dodge_f(float c1, float c2) {
	return (c1==1.0)?c1:min(c2/(1.0-c1),1.0);
}

vec3 blend_dodge(vec2 uv, vec3 c1, vec3 c2, float opacity) {
	return opacity*vec3(blend_dodge_f(c1.x, c2.x), blend_dodge_f(c1.y, c2.y), blend_dodge_f(c1.z, c2.z)) + (1.0-opacity)*c2;
}

vec3 blend_lighten(vec2 uv, vec3 c1, vec3 c2, float opacity) {
	return opacity*max(c1, c2) + (1.0-opacity)*c2;
}

vec3 blend_darken(vec2 uv, vec3 c1, vec3 c2, float opacity) {
	return opacity*min(c1, c2) + (1.0-opacity)*c2;
}

vec3 blend_difference(vec2 uv, vec3 c1, vec3 c2, float opacity) {
	return opacity*clamp(c2-c1, vec3(0.0), vec3(1.0)) + (1.0-opacity)*c2;
}
const float p_o212453_gradient_0_pos = 0.000000000;
const float p_o212453_gradient_0_r = 0.098958001;
const float p_o212453_gradient_0_g = 0.068034001;
const float p_o212453_gradient_0_b = 0.000000000;
const float p_o212453_gradient_0_a = 1.000000000;
const float p_o212453_gradient_1_pos = 1.000000000;
const float p_o212453_gradient_1_r = 0.246093750;
const float p_o212453_gradient_1_g = 0.886372209;
const float p_o212453_gradient_1_b = 1.000000000;
const float p_o212453_gradient_1_a = 1.000000000;
vec4 o212453_gradient_gradient_fct(float x) {
  if (x < p_o212453_gradient_0_pos) {
    return vec4(p_o212453_gradient_0_r,p_o212453_gradient_0_g,p_o212453_gradient_0_b,p_o212453_gradient_0_a);
  } else if (x < p_o212453_gradient_1_pos) {
    return mix(vec4(p_o212453_gradient_0_r,p_o212453_gradient_0_g,p_o212453_gradient_0_b,p_o212453_gradient_0_a), vec4(p_o212453_gradient_1_r,p_o212453_gradient_1_g,p_o212453_gradient_1_b,p_o212453_gradient_1_a), ((x-p_o212453_gradient_0_pos)/(p_o212453_gradient_1_pos-p_o212453_gradient_0_pos)));
  }
  return vec4(p_o212453_gradient_1_r,p_o212453_gradient_1_g,p_o212453_gradient_1_b,p_o212453_gradient_1_a);
}
const float p_o212401_amount = 1.000000000;
const float p_o212386_gradient_0_pos = 0.000000000;
const float p_o212386_gradient_0_r = 1.000000000;
const float p_o212386_gradient_0_g = 1.000000000;
const float p_o212386_gradient_0_b = 1.000000000;
const float p_o212386_gradient_0_a = 1.000000000;
const float p_o212386_gradient_1_pos = 0.049912000;
const float p_o212386_gradient_1_r = 0.947916985;
const float p_o212386_gradient_1_g = 0.947916985;
const float p_o212386_gradient_1_b = 0.947916985;
const float p_o212386_gradient_1_a = 1.000000000;
const float p_o212386_gradient_2_pos = 0.106977000;
const float p_o212386_gradient_2_r = 0.115584001;
const float p_o212386_gradient_2_g = 0.115584001;
const float p_o212386_gradient_2_b = 0.115584001;
const float p_o212386_gradient_2_a = 1.000000000;
const float p_o212386_gradient_3_pos = 0.290909000;
const float p_o212386_gradient_3_r = 0.000000000;
const float p_o212386_gradient_3_g = 0.000000000;
const float p_o212386_gradient_3_b = 0.000000000;
const float p_o212386_gradient_3_a = 1.000000000;
vec4 o212386_gradient_gradient_fct(float x) {
  if (x < p_o212386_gradient_0_pos) {
    return vec4(p_o212386_gradient_0_r,p_o212386_gradient_0_g,p_o212386_gradient_0_b,p_o212386_gradient_0_a);
  } else if (x < p_o212386_gradient_1_pos) {
    return mix(vec4(p_o212386_gradient_0_r,p_o212386_gradient_0_g,p_o212386_gradient_0_b,p_o212386_gradient_0_a), vec4(p_o212386_gradient_1_r,p_o212386_gradient_1_g,p_o212386_gradient_1_b,p_o212386_gradient_1_a), ((x-p_o212386_gradient_0_pos)/(p_o212386_gradient_1_pos-p_o212386_gradient_0_pos)));
  } else if (x < p_o212386_gradient_2_pos) {
    return mix(vec4(p_o212386_gradient_1_r,p_o212386_gradient_1_g,p_o212386_gradient_1_b,p_o212386_gradient_1_a), vec4(p_o212386_gradient_2_r,p_o212386_gradient_2_g,p_o212386_gradient_2_b,p_o212386_gradient_2_a), ((x-p_o212386_gradient_1_pos)/(p_o212386_gradient_2_pos-p_o212386_gradient_1_pos)));
  } else if (x < p_o212386_gradient_3_pos) {
    return mix(vec4(p_o212386_gradient_2_r,p_o212386_gradient_2_g,p_o212386_gradient_2_b,p_o212386_gradient_2_a), vec4(p_o212386_gradient_3_r,p_o212386_gradient_3_g,p_o212386_gradient_3_b,p_o212386_gradient_3_a), ((x-p_o212386_gradient_2_pos)/(p_o212386_gradient_3_pos-p_o212386_gradient_2_pos)));
  }
  return vec4(p_o212386_gradient_3_r,p_o212386_gradient_3_g,p_o212386_gradient_3_b,p_o212386_gradient_3_a);
}
const int seed_o212466 = 2869;
const float p_o212466_sx = 20.000000000;
const float p_o212466_sy = 12.000000000;
const float p_o212372_gradient_0_pos = 0.000000000;
const float p_o212372_gradient_0_r = 0.000000000;
const float p_o212372_gradient_0_g = 0.000000000;
const float p_o212372_gradient_0_b = 0.000000000;
const float p_o212372_gradient_0_a = 1.000000000;
const float p_o212372_gradient_1_pos = 0.583818000;
const float p_o212372_gradient_1_r = 0.225430995;
const float p_o212372_gradient_1_g = 0.225430995;
const float p_o212372_gradient_1_b = 0.225430995;
const float p_o212372_gradient_1_a = 1.000000000;
const float p_o212372_gradient_2_pos = 0.672727000;
const float p_o212372_gradient_2_r = 0.968750000;
const float p_o212372_gradient_2_g = 0.968750000;
const float p_o212372_gradient_2_b = 0.968750000;
const float p_o212372_gradient_2_a = 1.000000000;
vec4 o212372_gradient_gradient_fct(float x) {
  if (x < p_o212372_gradient_0_pos) {
    return vec4(p_o212372_gradient_0_r,p_o212372_gradient_0_g,p_o212372_gradient_0_b,p_o212372_gradient_0_a);
  } else if (x < p_o212372_gradient_1_pos) {
    return mix(vec4(p_o212372_gradient_0_r,p_o212372_gradient_0_g,p_o212372_gradient_0_b,p_o212372_gradient_0_a), vec4(p_o212372_gradient_1_r,p_o212372_gradient_1_g,p_o212372_gradient_1_b,p_o212372_gradient_1_a), ((x-p_o212372_gradient_0_pos)/(p_o212372_gradient_1_pos-p_o212372_gradient_0_pos)));
  } else if (x < p_o212372_gradient_2_pos) {
    return mix(vec4(p_o212372_gradient_1_r,p_o212372_gradient_1_g,p_o212372_gradient_1_b,p_o212372_gradient_1_a), vec4(p_o212372_gradient_2_r,p_o212372_gradient_2_g,p_o212372_gradient_2_b,p_o212372_gradient_2_a), ((x-p_o212372_gradient_1_pos)/(p_o212372_gradient_2_pos-p_o212372_gradient_1_pos)));
  }
  return vec4(p_o212372_gradient_2_r,p_o212372_gradient_2_g,p_o212372_gradient_2_b,p_o212372_gradient_2_a);
}



in vec2 uv;
out vec4 frag_color;

void main() {
    vec2 UV = uv;
    vec2 o212466_0_uv = (UV)*vec2(p_o212466_sx, p_o212466_sy*1.73205080757);
    vec4 o212466_0_center = beehive_center(o212466_0_uv);float o212466_0_1_f = 1.0-2.0*beehive_dist(o212466_0_center.xy);
    vec4 o212386_0_1_rgba = o212386_gradient_gradient_fct(o212466_0_1_f);
    vec3 o212466_1_2_rgb = rand3(fract(o212466_0_center.zw/vec2(p_o212466_sx, p_o212466_sy))+vec2(float(seed_o212466)));
    vec4 o212372_0_1_rgba = o212372_gradient_gradient_fct((dot(o212466_1_2_rgb, vec3(1.0))/3.0));
    vec4 o212401_0_s1 = o212386_0_1_rgba;
    vec4 o212401_0_s2 = o212372_0_1_rgba;
    float o212401_0_a = p_o212401_amount*1.0;
    vec4 o212401_0_2_rgba = vec4(blend_lighten((UV), o212401_0_s1.rgb, o212401_0_s2.rgb, o212401_0_a*o212401_0_s1.a), min(1.0, o212401_0_s2.a+o212401_0_a*o212401_0_s1.a));
    vec4 o212453_0_1_rgba = o212453_gradient_gradient_fct((dot((o212401_0_2_rgba).rgb, vec3(1.0))/3.0));
    frag_color = o212453_0_1_rgba;
}

@end

@program honeycomb vs fs