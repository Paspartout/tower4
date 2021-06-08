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
//---

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

float perlin(vec2 uv, vec2 size, int iterations, float persistence, int seed) {
	vec2 seed2 = rand2(vec2(float(seed), 1.0-float(seed)));
    float rv = 0.0;
    float coef = 1.0;
    float acc = 0.0;
    for (int i = 0; i < iterations; ++i) {
    	vec2 step = vec2(1.0)/size;
		vec2 xy = floor(uv*size);
        float f0 = rand(seed2+mod(xy, size));
        float f1 = rand(seed2+mod(xy+vec2(1.0, 0.0), size));
        float f2 = rand(seed2+mod(xy+vec2(0.0, 1.0), size));
        float f3 = rand(seed2+mod(xy+vec2(1.0, 1.0), size));
        vec2 mixval = smoothstep(0.0, 1.0, fract(uv*size));
        rv += coef * mix(mix(f0, f1, mixval.x), mix(f2, f3, mixval.x), mixval.y);
        acc += coef;
        size *= 2.0;
        coef *= persistence;
    }
    
    return rv / acc;
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
vec4 brick(vec2 uv, vec2 bmin, vec2 bmax, float mortar, float round, float bevel) {
	float color;
	vec2 size = bmax - bmin;
	float min_size = min(size.x, size.y);
	mortar *= min_size;
	bevel *= min_size;
	round *= min_size;
	vec2 center = 0.5*(bmin+bmax);
    vec2 d = abs(uv-center)-0.5*(size)+vec2(round+mortar);
    color = length(max(d,vec2(0))) + min(max(d.x,d.y),0.0)-round;
	color = clamp(-color/bevel, 0.0, 1.0);
	vec2 tiled_brick_pos = mod(bmin, vec2(1.0, 1.0));
	return vec4(color, center, tiled_brick_pos.x+7.0*tiled_brick_pos.y);
}

vec3 brick_random_color(vec2 bmin, vec2 bmax, float seed) {
	vec2 center = 0.5*(bmin + bmax);
	return rand3(fract(center + vec2(seed)));
}

vec3 brick_uv(vec2 uv, vec2 bmin, vec2 bmax, float seed) {
	vec2 center = 0.5*(bmin + bmax);
	vec2 size = bmax - bmin;
	float max_size = max(size.x, size.y);
	return vec3(0.5+(uv-center)/max_size, rand(fract(center)+vec2(seed)));
}

vec3 brick_corner_uv(vec2 uv, vec2 bmin, vec2 bmax, float mortar, float corner, float seed) {
	vec2 center = 0.5*(bmin + bmax);
	vec2 size = bmax - bmin;
	float max_size = max(size.x, size.y);
	float min_size = min(size.x, size.y);
	mortar *= min_size;
	corner *= min_size;
	return vec3(clamp((0.5*size-vec2(mortar)-abs(uv-center))/corner, vec2(0.0), vec2(1.0)), rand(fract(center)+vec2(seed)));
}

vec4 bricks_rb(vec2 uv, vec2 count, float repeat, float offset) {
	count *= repeat;
	float x_offset = offset*step(0.5, fract(uv.y*count.y*0.5));
	vec2 bmin = floor(vec2(uv.x*count.x-x_offset, uv.y*count.y));
	bmin.x += x_offset;
	bmin /= count;
	return vec4(bmin, bmin+vec2(1.0)/count);
}

vec4 bricks_rb2(vec2 uv, vec2 count, float repeat, float offset) {
	count *= repeat;
	float x_offset = offset*step(0.5, fract(uv.y*count.y*0.5));
	count.x = count.x*(1.0+step(0.5, fract(uv.y*count.y*0.5)));
	vec2 bmin = floor(vec2(uv.x*count.x-x_offset, uv.y*count.y));
	bmin.x += x_offset;
	bmin /= count;
	return vec4(bmin, bmin+vec2(1.0)/count);
}

vec4 bricks_hb(vec2 uv, vec2 count, float repeat, float offset) {
	float pc = count.x+count.y;
	float c = pc*repeat;
	vec2 corner = floor(uv*c);
	float cdiff = mod(corner.x-corner.y, pc);
	if (cdiff < count.x) {
		return vec4((corner-vec2(cdiff, 0.0))/c, (corner-vec2(cdiff, 0.0)+vec2(count.x, 1.0))/c);
	} else {
		return vec4((corner-vec2(0.0, pc-cdiff-1.0))/c, (corner-vec2(0.0, pc-cdiff-1.0)+vec2(1.0, count.y))/c);
	}
}

vec4 bricks_bw(vec2 uv, vec2 count, float repeat, float offset) {
	vec2 c = 2.0*count*repeat;
	float mc = max(c.x, c.y);
	vec2 corner1 = floor(uv*c);
	vec2 corner2 = count*floor(repeat*2.0*uv);
	float cdiff = mod(dot(floor(repeat*2.0*uv), vec2(1.0)), 2.0);
	vec2 corner;
	vec2 size;
	if (cdiff == 0.0) {
		corner = vec2(corner1.x, corner2.y);
		size = vec2(1.0, count.y);
	} else {
		corner = vec2(corner2.x, corner1.y);
		size = vec2(count.x, 1.0);
	}
	return vec4(corner/c, (corner+size)/c);
}

vec4 bricks_sb(vec2 uv, vec2 count, float repeat, float offset) {
	vec2 c = (count+vec2(1.0))*repeat;
	float mc = max(c.x, c.y);
	vec2 corner1 = floor(uv*c);
	vec2 corner2 = (count+vec2(1.0))*floor(repeat*uv);
	vec2 rcorner = corner1 - corner2;
	vec2 corner;
	vec2 size;
	if (rcorner.x == 0.0 && rcorner.y < count.y) {
		corner = corner2;
		size = vec2(1.0, count.y);
	} else if (rcorner.y == 0.0) {
		corner = corner2+vec2(1.0, 0.0);
		size = vec2(count.x, 1.0);
	} else if (rcorner.x == count.x) {
		corner = corner2+vec2(count.x, 1.0);
		size = vec2(1.0, count.y);
	} else if (rcorner.y == count.y) {
		corner = corner2+vec2(0.0, count.y);
		size = vec2(count.x, 1.0);
	} else {
		corner = corner2+vec2(1.0);
		size = vec2(count.x-1.0, count.y-1.0);
	}
	return vec4(corner/c, (corner+size)/c);
}const float p_o55557_amount = 1.000000000;
const float p_o55514_amount = 1.000000000;
const float p_o55499_gradient_0_pos = 0.476686000;
const float p_o55499_gradient_0_r = 0.529120982;
const float p_o55499_gradient_0_g = 0.292764992;
const float p_o55499_gradient_0_b = 0.273874998;
const float p_o55499_gradient_0_a = 1.000000000;
const float p_o55499_gradient_1_pos = 0.477339000;
const float p_o55499_gradient_1_r = 0.276042014;
const float p_o55499_gradient_1_g = 0.193957001;
const float p_o55499_gradient_1_b = 0.185466006;
const float p_o55499_gradient_1_a = 1.000000000;
const float p_o55499_gradient_2_pos = 0.733221000;
const float p_o55499_gradient_2_r = 0.276042014;
const float p_o55499_gradient_2_g = 0.193957001;
const float p_o55499_gradient_2_b = 0.185466006;
const float p_o55499_gradient_2_a = 1.000000000;
const float p_o55499_gradient_3_pos = 0.734721000;
const float p_o55499_gradient_3_r = 0.739583015;
const float p_o55499_gradient_3_g = 0.625828981;
const float p_o55499_gradient_3_b = 0.566242993;
const float p_o55499_gradient_3_a = 1.000000000;
vec4 o55499_gradient_gradient_fct(float x) {
  if (x < p_o55499_gradient_0_pos) {
    return vec4(p_o55499_gradient_0_r,p_o55499_gradient_0_g,p_o55499_gradient_0_b,p_o55499_gradient_0_a);
  } else if (x < p_o55499_gradient_1_pos) {
    return mix(vec4(p_o55499_gradient_0_r,p_o55499_gradient_0_g,p_o55499_gradient_0_b,p_o55499_gradient_0_a), vec4(p_o55499_gradient_1_r,p_o55499_gradient_1_g,p_o55499_gradient_1_b,p_o55499_gradient_1_a), ((x-p_o55499_gradient_0_pos)/(p_o55499_gradient_1_pos-p_o55499_gradient_0_pos)));
  } else if (x < p_o55499_gradient_2_pos) {
    return mix(vec4(p_o55499_gradient_1_r,p_o55499_gradient_1_g,p_o55499_gradient_1_b,p_o55499_gradient_1_a), vec4(p_o55499_gradient_2_r,p_o55499_gradient_2_g,p_o55499_gradient_2_b,p_o55499_gradient_2_a), ((x-p_o55499_gradient_1_pos)/(p_o55499_gradient_2_pos-p_o55499_gradient_1_pos)));
  } else if (x < p_o55499_gradient_3_pos) {
    return mix(vec4(p_o55499_gradient_2_r,p_o55499_gradient_2_g,p_o55499_gradient_2_b,p_o55499_gradient_2_a), vec4(p_o55499_gradient_3_r,p_o55499_gradient_3_g,p_o55499_gradient_3_b,p_o55499_gradient_3_a), ((x-p_o55499_gradient_2_pos)/(p_o55499_gradient_3_pos-p_o55499_gradient_2_pos)));
  }
  return vec4(p_o55499_gradient_3_r,p_o55499_gradient_3_g,p_o55499_gradient_3_b,p_o55499_gradient_3_a);
}
const float p_o55589_amount = 1.000000000;
const float p_o55590_gradient_0_pos = 0.715167000;
const float p_o55590_gradient_0_r = 0.000000000;
const float p_o55590_gradient_0_g = 0.000000000;
const float p_o55590_gradient_0_b = 0.000000000;
const float p_o55590_gradient_0_a = 1.000000000;
const float p_o55590_gradient_1_pos = 0.715269000;
const float p_o55590_gradient_1_r = 1.000000000;
const float p_o55590_gradient_1_g = 1.000000000;
const float p_o55590_gradient_1_b = 1.000000000;
const float p_o55590_gradient_1_a = 0.000000000;
vec4 o55590_gradient_gradient_fct(float x) {
  if (x < p_o55590_gradient_0_pos) {
    return vec4(p_o55590_gradient_0_r,p_o55590_gradient_0_g,p_o55590_gradient_0_b,p_o55590_gradient_0_a);
  } else if (x < p_o55590_gradient_1_pos) {
    return mix(vec4(p_o55590_gradient_0_r,p_o55590_gradient_0_g,p_o55590_gradient_0_b,p_o55590_gradient_0_a), vec4(p_o55590_gradient_1_r,p_o55590_gradient_1_g,p_o55590_gradient_1_b,p_o55590_gradient_1_a), ((x-p_o55590_gradient_0_pos)/(p_o55590_gradient_1_pos-p_o55590_gradient_0_pos)));
  }
  return vec4(p_o55590_gradient_1_r,p_o55590_gradient_1_g,p_o55590_gradient_1_b,p_o55590_gradient_1_a);
}
const float p_o55617_amount = 1.000000000;
const float p_o55543_gradient_0_pos = 0.272727000;
const float p_o55543_gradient_0_r = 0.000000000;
const float p_o55543_gradient_0_g = 0.000000000;
const float p_o55543_gradient_0_b = 0.000000000;
const float p_o55543_gradient_0_a = 0.588235021;
const float p_o55543_gradient_1_pos = 0.407774000;
const float p_o55543_gradient_1_r = 1.000000000;
const float p_o55543_gradient_1_g = 1.000000000;
const float p_o55543_gradient_1_b = 1.000000000;
const float p_o55543_gradient_1_a = 0.000000000;
vec4 o55543_gradient_gradient_fct(float x) {
  if (x < p_o55543_gradient_0_pos) {
    return vec4(p_o55543_gradient_0_r,p_o55543_gradient_0_g,p_o55543_gradient_0_b,p_o55543_gradient_0_a);
  } else if (x < p_o55543_gradient_1_pos) {
    return mix(vec4(p_o55543_gradient_0_r,p_o55543_gradient_0_g,p_o55543_gradient_0_b,p_o55543_gradient_0_a), vec4(p_o55543_gradient_1_r,p_o55543_gradient_1_g,p_o55543_gradient_1_b,p_o55543_gradient_1_a), ((x-p_o55543_gradient_0_pos)/(p_o55543_gradient_1_pos-p_o55543_gradient_0_pos)));
  }
  return vec4(p_o55543_gradient_1_r,p_o55543_gradient_1_g,p_o55543_gradient_1_b,p_o55543_gradient_1_a);
}
const int seed_o55542 = -44736;
const float p_o55542_scale_x = 128.000000000;
const float p_o55542_scale_y = 128.000000000;
const float p_o55542_iterations = 8.000000000;
const float p_o55542_persistence = 0.500000000;
const float p_o55529_gradient_0_pos = 0.163636000;
const float p_o55529_gradient_0_r = 0.000000000;
const float p_o55529_gradient_0_g = 0.000000000;
const float p_o55529_gradient_0_b = 0.000000000;
const float p_o55529_gradient_0_a = 0.898038983;
const float p_o55529_gradient_1_pos = 0.463636000;
const float p_o55529_gradient_1_r = 0.984314024;
const float p_o55529_gradient_1_g = 0.984314024;
const float p_o55529_gradient_1_b = 0.984314024;
const float p_o55529_gradient_1_a = 0.000000000;
vec4 o55529_gradient_gradient_fct(float x) {
  if (x < p_o55529_gradient_0_pos) {
    return vec4(p_o55529_gradient_0_r,p_o55529_gradient_0_g,p_o55529_gradient_0_b,p_o55529_gradient_0_a);
  } else if (x < p_o55529_gradient_1_pos) {
    return mix(vec4(p_o55529_gradient_0_r,p_o55529_gradient_0_g,p_o55529_gradient_0_b,p_o55529_gradient_0_a), vec4(p_o55529_gradient_1_r,p_o55529_gradient_1_g,p_o55529_gradient_1_b,p_o55529_gradient_1_a), ((x-p_o55529_gradient_0_pos)/(p_o55529_gradient_1_pos-p_o55529_gradient_0_pos)));
  }
  return vec4(p_o55529_gradient_1_r,p_o55529_gradient_1_g,p_o55529_gradient_1_b,p_o55529_gradient_1_a);
}
const int seed_o55528 = -44576;
const float p_o55528_scale_x = 16.000000000;
const float p_o55528_scale_y = 16.000000000;
const float p_o55528_iterations = 8.000000000;
const float p_o55528_persistence = 0.500000000;
const int seed_o55618 = 44964;
const float p_o55618_repeat = 1.000000000;
const float p_o55618_rows = 20.000000000;
const float p_o55618_columns = 6.000000000;
const float p_o55618_row_offset = 0.500000000;
const float p_o55618_mortar = 0.000000000;
const float p_o55618_bevel = 0.087751000;
const float p_o55618_round = 0.000000000;
const float p_o55618_corner = 0.000000000;
const float p_o55603_gradient_0_pos = 0.209091000;
const float p_o55603_gradient_0_r = 0.354167014;
const float p_o55603_gradient_0_g = 0.354167014;
const float p_o55603_gradient_0_b = 0.354167014;
const float p_o55603_gradient_0_a = 1.000000000;
const float p_o55603_gradient_1_pos = 0.500000000;
const float p_o55603_gradient_1_r = 0.536458015;
const float p_o55603_gradient_1_g = 0.536458015;
const float p_o55603_gradient_1_b = 0.536458015;
const float p_o55603_gradient_1_a = 1.000000000;
const float p_o55603_gradient_2_pos = 0.936364000;
const float p_o55603_gradient_2_r = 0.166666999;
const float p_o55603_gradient_2_g = 0.166666999;
const float p_o55603_gradient_2_b = 0.166666999;
const float p_o55603_gradient_2_a = 1.000000000;
vec4 o55603_gradient_gradient_fct(float x) {
  if (x < p_o55603_gradient_0_pos) {
    return vec4(p_o55603_gradient_0_r,p_o55603_gradient_0_g,p_o55603_gradient_0_b,p_o55603_gradient_0_a);
  } else if (x < p_o55603_gradient_1_pos) {
    return mix(vec4(p_o55603_gradient_0_r,p_o55603_gradient_0_g,p_o55603_gradient_0_b,p_o55603_gradient_0_a), vec4(p_o55603_gradient_1_r,p_o55603_gradient_1_g,p_o55603_gradient_1_b,p_o55603_gradient_1_a), ((x-p_o55603_gradient_0_pos)/(p_o55603_gradient_1_pos-p_o55603_gradient_0_pos)));
  } else if (x < p_o55603_gradient_2_pos) {
    return mix(vec4(p_o55603_gradient_1_r,p_o55603_gradient_1_g,p_o55603_gradient_1_b,p_o55603_gradient_1_a), vec4(p_o55603_gradient_2_r,p_o55603_gradient_2_g,p_o55603_gradient_2_b,p_o55603_gradient_2_a), ((x-p_o55603_gradient_1_pos)/(p_o55603_gradient_2_pos-p_o55603_gradient_1_pos)));
  }
  return vec4(p_o55603_gradient_2_r,p_o55603_gradient_2_g,p_o55603_gradient_2_b,p_o55603_gradient_2_a);
}
const int seed_o55588 = -19144;
const float p_o55588_scale_x = 4.000000000;
const float p_o55588_scale_y = 4.000000000;
const float p_o55588_iterations = 8.000000000;
const float p_o55588_persistence = 1.000000000;
const float p_o55681_gradient_0_pos = 0.710909000;
const float p_o55681_gradient_0_r = 0.000000000;
const float p_o55681_gradient_0_g = 0.000000000;
const float p_o55681_gradient_0_b = 0.000000000;
const float p_o55681_gradient_0_a = 1.000000000;
const float p_o55681_gradient_1_pos = 0.720000000;
const float p_o55681_gradient_1_r = 1.000000000;
const float p_o55681_gradient_1_g = 1.000000000;
const float p_o55681_gradient_1_b = 1.000000000;
const float p_o55681_gradient_1_a = 1.000000000;
vec4 o55681_gradient_gradient_fct(float x) {
  if (x < p_o55681_gradient_0_pos) {
    return vec4(p_o55681_gradient_0_r,p_o55681_gradient_0_g,p_o55681_gradient_0_b,p_o55681_gradient_0_a);
  } else if (x < p_o55681_gradient_1_pos) {
    return mix(vec4(p_o55681_gradient_0_r,p_o55681_gradient_0_g,p_o55681_gradient_0_b,p_o55681_gradient_0_a), vec4(p_o55681_gradient_1_r,p_o55681_gradient_1_g,p_o55681_gradient_1_b,p_o55681_gradient_1_a), ((x-p_o55681_gradient_0_pos)/(p_o55681_gradient_1_pos-p_o55681_gradient_0_pos)));
  }
  return vec4(p_o55681_gradient_1_r,p_o55681_gradient_1_g,p_o55681_gradient_1_b,p_o55681_gradient_1_a);
}
const float p_o55558_color_r = 0.125489995;
const float p_o55558_color_g = 0.078431003;
const float p_o55558_color_b = 0.047059000;
const float p_o55558_color_a = 1.000000000;
const float p_o55559_gradient_0_pos = 0.000000000;
const float p_o55559_gradient_0_r = 0.302082986;
const float p_o55559_gradient_0_g = 0.302082986;
const float p_o55559_gradient_0_b = 0.302082986;
const float p_o55559_gradient_0_a = 1.000000000;
const float p_o55559_gradient_1_pos = 0.710145000;
const float p_o55559_gradient_1_r = 1.000000000;
const float p_o55559_gradient_1_g = 1.000000000;
const float p_o55559_gradient_1_b = 1.000000000;
const float p_o55559_gradient_1_a = 1.000000000;
vec4 o55559_gradient_gradient_fct(float x) {
  if (x < p_o55559_gradient_0_pos) {
    return vec4(p_o55559_gradient_0_r,p_o55559_gradient_0_g,p_o55559_gradient_0_b,p_o55559_gradient_0_a);
  } else if (x < p_o55559_gradient_1_pos) {
    return mix(vec4(p_o55559_gradient_0_r,p_o55559_gradient_0_g,p_o55559_gradient_0_b,p_o55559_gradient_0_a), vec4(p_o55559_gradient_1_r,p_o55559_gradient_1_g,p_o55559_gradient_1_b,p_o55559_gradient_1_a), ((x-p_o55559_gradient_0_pos)/(p_o55559_gradient_1_pos-p_o55559_gradient_0_pos)));
  }
  return vec4(p_o55559_gradient_1_r,p_o55559_gradient_1_g,p_o55559_gradient_1_b,p_o55559_gradient_1_a);
}
const int seed_o55556 = -44536;
const float p_o55556_scale_x = 16.000000000;
const float p_o55556_scale_y = 16.000000000;
const float p_o55556_iterations = 8.000000000;
const float p_o55556_persistence = 0.800000000;

in vec2 uv;
out vec4 frag_color;

void main() {
    vec2 UV = uv;
  float o55542_0_1_f = perlin((UV), vec2(p_o55542_scale_x, p_o55542_scale_y), int(p_o55542_iterations), p_o55542_persistence, seed_o55542);
  vec4 o55543_0_1_rgba = o55543_gradient_gradient_fct(o55542_0_1_f);
  float o55528_0_1_f = perlin((UV), vec2(p_o55528_scale_x, p_o55528_scale_y), int(p_o55528_iterations), p_o55528_persistence, seed_o55528);
  vec4 o55529_0_1_rgba = o55529_gradient_gradient_fct(o55528_0_1_f);
  vec4 o55617_0_s1 = o55543_0_1_rgba;
  vec4 o55617_0_s2 = o55529_0_1_rgba;
  float o55617_0_a = p_o55617_amount*1.0;
  vec4 o55617_0_2_rgba = vec4(blend_normal((UV), o55617_0_s1.rgb, o55617_0_s2.rgb, o55617_0_a*o55617_0_s1.a), min(1.0, o55617_0_s2.a+o55617_0_a*o55617_0_s1.a));
  vec4 o55590_0_1_rgba = o55590_gradient_gradient_fct((dot((o55617_0_2_rgba).rgb, vec3(1.0))/3.0));
  vec4 o55618_0_rect = bricks_rb2((UV), vec2(p_o55618_columns, p_o55618_rows), p_o55618_repeat, p_o55618_row_offset);
  vec4 o55618_0 = brick((UV), o55618_0_rect.xy, o55618_0_rect.zw, p_o55618_mortar*1.0, p_o55618_round*1.0, max(0.001, p_o55618_bevel*1.0));
  vec3 o55618_1_2_rgb = brick_random_color(o55618_0_rect.xy, o55618_0_rect.zw, float(seed_o55618));
  vec4 o55589_0_s1 = o55590_0_1_rgba;
  vec4 o55589_0_s2 = vec4(o55618_1_2_rgb, 1.0);
  float o55589_0_a = p_o55589_amount*1.0;
  vec4 o55589_0_2_rgba = vec4(blend_normal((UV), o55589_0_s1.rgb, o55589_0_s2.rgb, o55589_0_a*o55589_0_s1.a), min(1.0, o55589_0_s2.a+o55589_0_a*o55589_0_s1.a));
  vec4 o55499_0_1_rgba = o55499_gradient_gradient_fct((dot((o55589_0_2_rgba).rgb, vec3(1.0))/3.0));
  float o55588_0_1_f = perlin((UV), vec2(p_o55588_scale_x, p_o55588_scale_y), int(p_o55588_iterations), p_o55588_persistence, seed_o55588);
  vec4 o55603_0_1_rgba = o55603_gradient_gradient_fct(o55588_0_1_f);
  float o55618_0_3_f = o55618_0.x;
  vec4 o55681_0_1_rgba = o55681_gradient_gradient_fct(o55618_0_3_f);
  vec4 o55514_0_s1 = o55499_0_1_rgba;
  vec4 o55514_0_s2 = o55603_0_1_rgba;
  float o55514_0_a = p_o55514_amount*(dot((o55681_0_1_rgba).rgb, vec3(1.0))/3.0);
  vec4 o55514_0_1_rgba = vec4(blend_normal((UV), o55514_0_s1.rgb, o55514_0_s2.rgb, o55514_0_a*o55514_0_s1.a), min(1.0, o55514_0_s2.a+o55514_0_a*o55514_0_s1.a));
  vec4 o55558_0_1_rgba = vec4(p_o55558_color_r, p_o55558_color_g, p_o55558_color_b, p_o55558_color_a);
  float o55556_0_1_f = perlin((UV), vec2(p_o55556_scale_x, p_o55556_scale_y), int(p_o55556_iterations), p_o55556_persistence, seed_o55556);
  vec4 o55559_0_1_rgba = o55559_gradient_gradient_fct(o55556_0_1_f);
  vec4 o55557_0_s1 = o55514_0_1_rgba;
  vec4 o55557_0_s2 = o55558_0_1_rgba;
  float o55557_0_a = p_o55557_amount*(dot((o55559_0_1_rgba).rgb, vec3(1.0))/3.0);
  vec4 o55557_0_1_rgba = vec4(blend_normal((UV), o55557_0_s1.rgb, o55557_0_s2.rgb, o55557_0_a*o55557_0_s1.a), min(1.0, o55557_0_s2.a+o55557_0_a*o55557_0_s1.a));
  frag_color = o55557_0_1_rgba;
}

@end

@program honeycomb vs fs