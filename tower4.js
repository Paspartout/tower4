var Module = typeof Module !== "undefined" ? Module : {};

var moduleOverrides = {};

var key;

for (key in Module) {
 if (Module.hasOwnProperty(key)) {
  moduleOverrides[key] = Module[key];
 }
}

var arguments_ = [];

var thisProgram = "./this.program";

var quit_ = function(status, toThrow) {
 throw toThrow;
};

var ENVIRONMENT_IS_WEB = false;

var ENVIRONMENT_IS_WORKER = false;

var ENVIRONMENT_IS_NODE = false;

var ENVIRONMENT_IS_SHELL = false;

ENVIRONMENT_IS_WEB = typeof window === "object";

ENVIRONMENT_IS_WORKER = typeof importScripts === "function";

ENVIRONMENT_IS_NODE = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";

ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

var scriptDirectory = "";

function locateFile(path) {
 if (Module["locateFile"]) {
  return Module["locateFile"](path, scriptDirectory);
 }
 return scriptDirectory + path;
}

var read_, readAsync, readBinary, setWindowTitle;

var nodeFS;

var nodePath;

if (ENVIRONMENT_IS_NODE) {
 if (ENVIRONMENT_IS_WORKER) {
  scriptDirectory = require("path").dirname(scriptDirectory) + "/";
 } else {
  scriptDirectory = __dirname + "/";
 }
 read_ = function shell_read(filename, binary) {
  if (!nodeFS) nodeFS = require("fs");
  if (!nodePath) nodePath = require("path");
  filename = nodePath["normalize"](filename);
  return nodeFS["readFileSync"](filename, binary ? null : "utf8");
 };
 readBinary = function readBinary(filename) {
  var ret = read_(filename, true);
  if (!ret.buffer) {
   ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
 };
 if (process["argv"].length > 1) {
  thisProgram = process["argv"][1].replace(/\\/g, "/");
 }
 arguments_ = process["argv"].slice(2);
 if (typeof module !== "undefined") {
  module["exports"] = Module;
 }
 process["on"]("uncaughtException", function(ex) {
  if (!(ex instanceof ExitStatus)) {
   throw ex;
  }
 });
 process["on"]("unhandledRejection", abort);
 quit_ = function(status) {
  process["exit"](status);
 };
 Module["inspect"] = function() {
  return "[Emscripten Module object]";
 };
} else if (ENVIRONMENT_IS_SHELL) {
 if (typeof read != "undefined") {
  read_ = function shell_read(f) {
   return read(f);
  };
 }
 readBinary = function readBinary(f) {
  var data;
  if (typeof readbuffer === "function") {
   return new Uint8Array(readbuffer(f));
  }
  data = read(f, "binary");
  assert(typeof data === "object");
  return data;
 };
 if (typeof scriptArgs != "undefined") {
  arguments_ = scriptArgs;
 } else if (typeof arguments != "undefined") {
  arguments_ = arguments;
 }
 if (typeof quit === "function") {
  quit_ = function(status) {
   quit(status);
  };
 }
 if (typeof print !== "undefined") {
  if (typeof console === "undefined") console = {};
  console.log = print;
  console.warn = console.error = typeof printErr !== "undefined" ? printErr : print;
 }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
 if (ENVIRONMENT_IS_WORKER) {
  scriptDirectory = self.location.href;
 } else if (typeof document !== "undefined" && document.currentScript) {
  scriptDirectory = document.currentScript.src;
 }
 if (scriptDirectory.indexOf("blob:") !== 0) {
  scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1);
 } else {
  scriptDirectory = "";
 }
 {
  read_ = function(url) {
   var xhr = new XMLHttpRequest();
   xhr.open("GET", url, false);
   xhr.send(null);
   return xhr.responseText;
  };
  if (ENVIRONMENT_IS_WORKER) {
   readBinary = function(url) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.responseType = "arraybuffer";
    xhr.send(null);
    return new Uint8Array(xhr.response);
   };
  }
  readAsync = function(url, onload, onerror) {
   var xhr = new XMLHttpRequest();
   xhr.open("GET", url, true);
   xhr.responseType = "arraybuffer";
   xhr.onload = function() {
    if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
     onload(xhr.response);
     return;
    }
    onerror();
   };
   xhr.onerror = onerror;
   xhr.send(null);
  };
 }
 setWindowTitle = function(title) {
  document.title = title;
 };
} else {}

var out = Module["print"] || console.log.bind(console);

var err = Module["printErr"] || console.warn.bind(console);

for (key in moduleOverrides) {
 if (moduleOverrides.hasOwnProperty(key)) {
  Module[key] = moduleOverrides[key];
 }
}

moduleOverrides = null;

if (Module["arguments"]) arguments_ = Module["arguments"];

if (Module["thisProgram"]) thisProgram = Module["thisProgram"];

if (Module["quit"]) quit_ = Module["quit"];

var wasmBinary;

if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];

var noExitRuntime = Module["noExitRuntime"] || true;

if (typeof WebAssembly !== "object") {
 abort("no native wasm support detected");
}

var wasmMemory;

var ABORT = false;

var EXITSTATUS;

function assert(condition, text) {
 if (!condition) {
  abort("Assertion failed: " + text);
 }
}

function getCFunc(ident) {
 var func = Module["_" + ident];
 assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
 return func;
}

function ccall(ident, returnType, argTypes, args, opts) {
 var toC = {
  "string": function(str) {
   var ret = 0;
   if (str !== null && str !== undefined && str !== 0) {
    var len = (str.length << 2) + 1;
    ret = stackAlloc(len);
    stringToUTF8(str, ret, len);
   }
   return ret;
  },
  "array": function(arr) {
   var ret = stackAlloc(arr.length);
   writeArrayToMemory(arr, ret);
   return ret;
  }
 };
 function convertReturnValue(ret) {
  if (returnType === "string") return UTF8ToString(ret);
  if (returnType === "boolean") return Boolean(ret);
  return ret;
 }
 var func = getCFunc(ident);
 var cArgs = [];
 var stack = 0;
 if (args) {
  for (var i = 0; i < args.length; i++) {
   var converter = toC[argTypes[i]];
   if (converter) {
    if (stack === 0) stack = stackSave();
    cArgs[i] = converter(args[i]);
   } else {
    cArgs[i] = args[i];
   }
  }
 }
 var ret = func.apply(null, cArgs);
 ret = convertReturnValue(ret);
 if (stack !== 0) stackRestore(stack);
 return ret;
}

var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

function UTF8ArrayToString(heap, idx, maxBytesToRead) {
 var endIdx = idx + maxBytesToRead;
 var endPtr = idx;
 while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;
 if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
  return UTF8Decoder.decode(heap.subarray(idx, endPtr));
 } else {
  var str = "";
  while (idx < endPtr) {
   var u0 = heap[idx++];
   if (!(u0 & 128)) {
    str += String.fromCharCode(u0);
    continue;
   }
   var u1 = heap[idx++] & 63;
   if ((u0 & 224) == 192) {
    str += String.fromCharCode((u0 & 31) << 6 | u1);
    continue;
   }
   var u2 = heap[idx++] & 63;
   if ((u0 & 240) == 224) {
    u0 = (u0 & 15) << 12 | u1 << 6 | u2;
   } else {
    u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heap[idx++] & 63;
   }
   if (u0 < 65536) {
    str += String.fromCharCode(u0);
   } else {
    var ch = u0 - 65536;
    str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
   }
  }
 }
 return str;
}

function UTF8ToString(ptr, maxBytesToRead) {
 return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
}

function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
 if (!(maxBytesToWrite > 0)) return 0;
 var startIdx = outIdx;
 var endIdx = outIdx + maxBytesToWrite - 1;
 for (var i = 0; i < str.length; ++i) {
  var u = str.charCodeAt(i);
  if (u >= 55296 && u <= 57343) {
   var u1 = str.charCodeAt(++i);
   u = 65536 + ((u & 1023) << 10) | u1 & 1023;
  }
  if (u <= 127) {
   if (outIdx >= endIdx) break;
   heap[outIdx++] = u;
  } else if (u <= 2047) {
   if (outIdx + 1 >= endIdx) break;
   heap[outIdx++] = 192 | u >> 6;
   heap[outIdx++] = 128 | u & 63;
  } else if (u <= 65535) {
   if (outIdx + 2 >= endIdx) break;
   heap[outIdx++] = 224 | u >> 12;
   heap[outIdx++] = 128 | u >> 6 & 63;
   heap[outIdx++] = 128 | u & 63;
  } else {
   if (outIdx + 3 >= endIdx) break;
   heap[outIdx++] = 240 | u >> 18;
   heap[outIdx++] = 128 | u >> 12 & 63;
   heap[outIdx++] = 128 | u >> 6 & 63;
   heap[outIdx++] = 128 | u & 63;
  }
 }
 heap[outIdx] = 0;
 return outIdx - startIdx;
}

function stringToUTF8(str, outPtr, maxBytesToWrite) {
 return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
}

function lengthBytesUTF8(str) {
 var len = 0;
 for (var i = 0; i < str.length; ++i) {
  var u = str.charCodeAt(i);
  if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
  if (u <= 127) ++len; else if (u <= 2047) len += 2; else if (u <= 65535) len += 3; else len += 4;
 }
 return len;
}

function allocateUTF8OnStack(str) {
 var size = lengthBytesUTF8(str) + 1;
 var ret = stackAlloc(size);
 stringToUTF8Array(str, HEAP8, ret, size);
 return ret;
}

function writeArrayToMemory(array, buffer) {
 HEAP8.set(array, buffer);
}

var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBufferAndViews(buf) {
 buffer = buf;
 Module["HEAP8"] = HEAP8 = new Int8Array(buf);
 Module["HEAP16"] = HEAP16 = new Int16Array(buf);
 Module["HEAP32"] = HEAP32 = new Int32Array(buf);
 Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
 Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
 Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
 Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
 Module["HEAPF64"] = HEAPF64 = new Float64Array(buf);
}

var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 16777216;

var wasmTable;

var __ATPRERUN__ = [];

var __ATINIT__ = [];

var __ATMAIN__ = [];

var __ATEXIT__ = [];

var __ATPOSTRUN__ = [];

var runtimeInitialized = false;

var runtimeExited = false;

function preRun() {
 if (Module["preRun"]) {
  if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
  while (Module["preRun"].length) {
   addOnPreRun(Module["preRun"].shift());
  }
 }
 callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
 runtimeInitialized = true;
 callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
 callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
 runtimeExited = true;
}

function postRun() {
 if (Module["postRun"]) {
  if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
  while (Module["postRun"].length) {
   addOnPostRun(Module["postRun"].shift());
  }
 }
 callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
 __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
 __ATINIT__.unshift(cb);
}

function addOnPostRun(cb) {
 __ATPOSTRUN__.unshift(cb);
}

var runDependencies = 0;

var runDependencyWatcher = null;

var dependenciesFulfilled = null;

function addRunDependency(id) {
 runDependencies++;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
}

function removeRunDependency(id) {
 runDependencies--;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
 if (runDependencies == 0) {
  if (runDependencyWatcher !== null) {
   clearInterval(runDependencyWatcher);
   runDependencyWatcher = null;
  }
  if (dependenciesFulfilled) {
   var callback = dependenciesFulfilled;
   dependenciesFulfilled = null;
   callback();
  }
 }
}

Module["preloadedImages"] = {};

Module["preloadedAudios"] = {};

function abort(what) {
 if (Module["onAbort"]) {
  Module["onAbort"](what);
 }
 what += "";
 err(what);
 ABORT = true;
 EXITSTATUS = 1;
 what = "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
 var e = new WebAssembly.RuntimeError(what);
 throw e;
}

function hasPrefix(str, prefix) {
 return String.prototype.startsWith ? str.startsWith(prefix) : str.indexOf(prefix) === 0;
}

var dataURIPrefix = "data:application/octet-stream;base64,";

function isDataURI(filename) {
 return hasPrefix(filename, dataURIPrefix);
}

var fileURIPrefix = "file://";

function isFileURI(filename) {
 return hasPrefix(filename, fileURIPrefix);
}

var wasmBinaryFile = "tower4.wasm";

if (!isDataURI(wasmBinaryFile)) {
 wasmBinaryFile = locateFile(wasmBinaryFile);
}

function getBinary(file) {
 try {
  if (file == wasmBinaryFile && wasmBinary) {
   return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
   return readBinary(file);
  } else {
   throw "both async and sync fetching of the wasm failed";
  }
 } catch (err) {
  abort(err);
 }
}

function getBinaryPromise() {
 if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
  if (typeof fetch === "function" && !isFileURI(wasmBinaryFile)) {
   return fetch(wasmBinaryFile, {
    credentials: "same-origin"
   }).then(function(response) {
    if (!response["ok"]) {
     throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
    }
    return response["arrayBuffer"]();
   }).catch(function() {
    return getBinary(wasmBinaryFile);
   });
  } else {
   if (readAsync) {
    return new Promise(function(resolve, reject) {
     readAsync(wasmBinaryFile, function(response) {
      resolve(new Uint8Array(response));
     }, reject);
    });
   }
  }
 }
 return Promise.resolve().then(function() {
  return getBinary(wasmBinaryFile);
 });
}

function createWasm() {
 var info = {
  "a": asmLibraryArg
 };
 function receiveInstance(instance, module) {
  var exports = instance.exports;
  Module["asm"] = exports;
  wasmMemory = Module["asm"]["sb"];
  updateGlobalBufferAndViews(wasmMemory.buffer);
  wasmTable = Module["asm"]["ub"];
  addOnInit(Module["asm"]["tb"]);
  removeRunDependency("wasm-instantiate");
 }
 addRunDependency("wasm-instantiate");
 function receiveInstantiatedSource(output) {
  receiveInstance(output["instance"]);
 }
 function instantiateArrayBuffer(receiver) {
  return getBinaryPromise().then(function(binary) {
   var result = WebAssembly.instantiate(binary, info);
   return result;
  }).then(receiver, function(reason) {
   err("failed to asynchronously prepare wasm: " + reason);
   abort(reason);
  });
 }
 function instantiateAsync() {
  if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && !isFileURI(wasmBinaryFile) && typeof fetch === "function") {
   return fetch(wasmBinaryFile, {
    credentials: "same-origin"
   }).then(function(response) {
    var result = WebAssembly.instantiateStreaming(response, info);
    return result.then(receiveInstantiatedSource, function(reason) {
     err("wasm streaming compile failed: " + reason);
     err("falling back to ArrayBuffer instantiation");
     return instantiateArrayBuffer(receiveInstantiatedSource);
    });
   });
  } else {
   return instantiateArrayBuffer(receiveInstantiatedSource);
  }
 }
 if (Module["instantiateWasm"]) {
  try {
   var exports = Module["instantiateWasm"](info, receiveInstance);
   return exports;
  } catch (e) {
   err("Module.instantiateWasm callback failed with error: " + e);
   return false;
  }
 }
 instantiateAsync();
 return {};
}

function sapp_js_add_beforeunload_listener() {
 Module.sokol_beforeunload = function(event) {
  if (__sapp_html5_get_ask_leave_site() != 0) {
   event.preventDefault();
   event.returnValue = " ";
  }
 };
 window.addEventListener("beforeunload", Module.sokol_beforeunload);
}

function sapp_js_add_clipboard_listener() {
 Module.sokol_paste = function(event) {
  var pasted_str = event.clipboardData.getData("text");
  ccall("_sapp_emsc_onpaste", "void", [ "string" ], [ pasted_str ]);
 };
 window.addEventListener("paste", Module.sokol_paste);
}

function sapp_js_add_dragndrop_listeners(canvas_name_cstr) {
 Module.sokol_drop_files = [];
 var canvas_name = UTF8ToString(canvas_name_cstr);
 var canvas = document.getElementById(canvas_name);
 Module.sokol_dragenter = function(event) {
  event.stopPropagation();
  event.preventDefault();
 };
 Module.sokol_dragleave = function(event) {
  event.stopPropagation();
  event.preventDefault();
 };
 Module.sokol_dragover = function(event) {
  event.stopPropagation();
  event.preventDefault();
 };
 Module.sokol_drop = function(event) {
  event.stopPropagation();
  event.preventDefault();
  var files = event.dataTransfer.files;
  Module.sokol_dropped_files = files;
  __sapp_emsc_begin_drop(files.length);
  var i;
  for (i = 0; i < files.length; i++) {
   ccall("_sapp_emsc_drop", "void", [ "number", "string" ], [ i, files[i].name ]);
  }
  __sapp_emsc_end_drop(event.clientX, event.clientY);
 };
 canvas.addEventListener("dragenter", Module.sokol_dragenter, false);
 canvas.addEventListener("dragleave", Module.sokol_dragleave, false);
 canvas.addEventListener("dragover", Module.sokol_dragover, false);
 canvas.addEventListener("drop", Module.sokol_drop, false);
}

function sapp_js_clear_favicon() {
 var link = document.getElementById("sokol-app-favicon");
 if (link) {
  document.head.removeChild(link);
 }
}

function sapp_js_create_textfield() {
 var _sapp_inp = document.createElement("input");
 _sapp_inp.type = "text";
 _sapp_inp.id = "_sokol_app_input_element";
 _sapp_inp.autocapitalize = "none";
 _sapp_inp.addEventListener("focusout", function(_sapp_event) {
  __sapp_emsc_notify_keyboard_hidden();
 });
 document.body.append(_sapp_inp);
}

function sapp_js_focus_textfield() {
 document.getElementById("_sokol_app_input_element").focus();
}

function sapp_js_pointer_init(c_str_target) {
 var target_str = UTF8ToString(c_str_target);
 Module.sapp_emsc_target = document.getElementById(target_str);
 if (!Module.sapp_emsc_target) {
  console.log("sokol_app.h: invalid target:" + target_str);
 }
 if (!Module.sapp_emsc_target.requestPointerLock) {
  console.log("sokol_app.h: target doesn't support requestPointerLock:" + target_str);
 }
}

function sapp_js_remove_beforeunload_listener() {
 window.removeEventListener("beforeunload", Module.sokol_beforeunload);
}

function sapp_js_remove_clipboard_listener() {
 window.removeEventListener("paste", Module.sokol_paste);
}

function sapp_js_remove_dragndrop_listeners(canvas_name_cstr) {
 var canvas_name = UTF8ToString(canvas_name_cstr);
 var canvas = document.getElementById(canvas_name);
 canvas.removeEventListener("dragenter", Module.sokol_dragenter);
 canvas.removeEventListener("dragleave", Module.sokol_dragleave);
 canvas.removeEventListener("dragover", Module.sokol_dragover);
 canvas.removeEventListener("drop", Module.sokol_drop);
}

function sapp_js_request_pointerlock() {
 if (Module.sapp_emsc_target) {
  if (Module.sapp_emsc_target.requestPointerLock) {
   Module.sapp_emsc_target.requestPointerLock();
  }
 }
}

function sapp_js_set_favicon(w, h, pixels) {
 var canvas = document.createElement("canvas");
 canvas.width = w;
 canvas.height = h;
 var ctx = canvas.getContext("2d");
 var img_data = ctx.createImageData(w, h);
 img_data.data.set(HEAPU8.subarray(pixels, pixels + w * h * 4));
 ctx.putImageData(img_data, 0, 0);
 var new_link = document.createElement("link");
 new_link.id = "sokol-app-favicon";
 new_link.rel = "shortcut icon";
 new_link.href = canvas.toDataURL();
 document.head.appendChild(new_link);
}

function sapp_js_unfocus_textfield() {
 document.getElementById("_sokol_app_input_element").blur();
}

function sapp_js_write_clipboard(c_str) {
 var str = UTF8ToString(c_str);
 var ta = document.createElement("textarea");
 ta.setAttribute("autocomplete", "off");
 ta.setAttribute("autocorrect", "off");
 ta.setAttribute("autocapitalize", "off");
 ta.setAttribute("spellcheck", "false");
 ta.style.left = -100 + "px";
 ta.style.top = -100 + "px";
 ta.style.height = 1;
 ta.style.width = 1;
 ta.value = str;
 document.body.appendChild(ta);
 ta.select();
 document.execCommand("copy");
 document.body.removeChild(ta);
}

function saudio_js_buffer_frames() {
 if (Module._saudio_node) {
  return Module._saudio_node.bufferSize;
 } else {
  return 0;
 }
}

function saudio_js_init(sample_rate, num_channels, buffer_size) {
 Module._saudio_context = null;
 Module._saudio_node = null;
 if (typeof AudioContext !== "undefined") {
  Module._saudio_context = new AudioContext({
   sampleRate: sample_rate,
   latencyHint: "interactive"
  });
 } else if (typeof webkitAudioContext !== "undefined") {
  Module._saudio_context = new webkitAudioContext({
   sampleRate: sample_rate,
   latencyHint: "interactive"
  });
 } else {
  Module._saudio_context = null;
  console.log("sokol_audio.h: no WebAudio support");
 }
 if (Module._saudio_context) {
  console.log("sokol_audio.h: sample rate ", Module._saudio_context.sampleRate);
  Module._saudio_node = Module._saudio_context.createScriptProcessor(buffer_size, 0, num_channels);
  Module._saudio_node.onaudioprocess = function pump_audio(event) {
   var num_frames = event.outputBuffer.length;
   var ptr = __saudio_emsc_pull(num_frames);
   if (ptr) {
    var num_channels = event.outputBuffer.numberOfChannels;
    for (var chn = 0; chn < num_channels; chn++) {
     var chan = event.outputBuffer.getChannelData(chn);
     for (var i = 0; i < num_frames; i++) {
      chan[i] = HEAPF32[(ptr >> 2) + (num_channels * i + chn)];
     }
    }
   }
  };
  Module._saudio_node.connect(Module._saudio_context.destination);
  var resume_webaudio = function() {
   if (Module._saudio_context) {
    if (Module._saudio_context.state === "suspended") {
     Module._saudio_context.resume();
    }
   }
  };
  document.addEventListener("click", resume_webaudio, {
   once: true
  });
  document.addEventListener("touchstart", resume_webaudio, {
   once: true
  });
  document.addEventListener("keydown", resume_webaudio, {
   once: true
  });
  return 1;
 } else {
  return 0;
 }
}

function saudio_js_sample_rate() {
 if (Module._saudio_context) {
  return Module._saudio_context.sampleRate;
 } else {
  return 0;
 }
}

function saudio_js_shutdown() {
 if (Module._saudio_context !== null) {
  if (Module._saudio_node) {
   Module._saudio_node.disconnect();
  }
  Module._saudio_context.close();
  Module._saudio_context = null;
  Module._saudio_node = null;
 }
}

function simgui_js_is_osx() {
 if (navigator.userAgent.includes("Macintosh")) {
  return 1;
 } else {
  return 0;
 }
}

function stm_js_perfnow() {
 return performance.now();
}

function callRuntimeCallbacks(callbacks) {
 while (callbacks.length > 0) {
  var callback = callbacks.shift();
  if (typeof callback == "function") {
   callback(Module);
   continue;
  }
  var func = callback.func;
  if (typeof func === "number") {
   if (callback.arg === undefined) {
    wasmTable.get(func)();
   } else {
    wasmTable.get(func)(callback.arg);
   }
  } else {
   func(callback.arg === undefined ? null : callback.arg);
  }
 }
}

var runtimeKeepaliveCounter = 0;

function keepRuntimeAlive() {
 return noExitRuntime || runtimeKeepaliveCounter > 0;
}

var SYSCALLS = {
 mappings: {},
 buffers: [ null, [], [] ],
 printChar: function(stream, curr) {
  var buffer = SYSCALLS.buffers[stream];
  if (curr === 0 || curr === 10) {
   (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
   buffer.length = 0;
  } else {
   buffer.push(curr);
  }
 },
 varargs: undefined,
 get: function() {
  SYSCALLS.varargs += 4;
  var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
  return ret;
 },
 getStr: function(ptr) {
  var ret = UTF8ToString(ptr);
  return ret;
 },
 get64: function(low, high) {
  return low;
 }
};

function ___sys_fcntl64(fd, cmd, varargs) {
 SYSCALLS.varargs = varargs;
 return 0;
}

function ___sys_ioctl(fd, op, varargs) {
 SYSCALLS.varargs = varargs;
 return 0;
}

function ___sys_open(path, flags, varargs) {
 SYSCALLS.varargs = varargs;
}

function _emscripten_get_device_pixel_ratio() {
 return typeof devicePixelRatio === "number" && devicePixelRatio || 1;
}

var JSEvents = {
 inEventHandler: 0,
 removeAllEventListeners: function() {
  for (var i = JSEvents.eventHandlers.length - 1; i >= 0; --i) {
   JSEvents._removeHandler(i);
  }
  JSEvents.eventHandlers = [];
  JSEvents.deferredCalls = [];
 },
 registerRemoveEventListeners: function() {
  if (!JSEvents.removeEventListenersRegistered) {
   __ATEXIT__.push(JSEvents.removeAllEventListeners);
   JSEvents.removeEventListenersRegistered = true;
  }
 },
 deferredCalls: [],
 deferCall: function(targetFunction, precedence, argsList) {
  function arraysHaveEqualContent(arrA, arrB) {
   if (arrA.length != arrB.length) return false;
   for (var i in arrA) {
    if (arrA[i] != arrB[i]) return false;
   }
   return true;
  }
  for (var i in JSEvents.deferredCalls) {
   var call = JSEvents.deferredCalls[i];
   if (call.targetFunction == targetFunction && arraysHaveEqualContent(call.argsList, argsList)) {
    return;
   }
  }
  JSEvents.deferredCalls.push({
   targetFunction: targetFunction,
   precedence: precedence,
   argsList: argsList
  });
  JSEvents.deferredCalls.sort(function(x, y) {
   return x.precedence < y.precedence;
  });
 },
 removeDeferredCalls: function(targetFunction) {
  for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
   if (JSEvents.deferredCalls[i].targetFunction == targetFunction) {
    JSEvents.deferredCalls.splice(i, 1);
    --i;
   }
  }
 },
 canPerformEventHandlerRequests: function() {
  return JSEvents.inEventHandler && JSEvents.currentEventHandler.allowsDeferredCalls;
 },
 runDeferredCalls: function() {
  if (!JSEvents.canPerformEventHandlerRequests()) {
   return;
  }
  for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
   var call = JSEvents.deferredCalls[i];
   JSEvents.deferredCalls.splice(i, 1);
   --i;
   call.targetFunction.apply(null, call.argsList);
  }
 },
 eventHandlers: [],
 removeAllHandlersOnTarget: function(target, eventTypeString) {
  for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
   if (JSEvents.eventHandlers[i].target == target && (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)) {
    JSEvents._removeHandler(i--);
   }
  }
 },
 _removeHandler: function(i) {
  var h = JSEvents.eventHandlers[i];
  h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture);
  JSEvents.eventHandlers.splice(i, 1);
 },
 registerOrRemoveHandler: function(eventHandler) {
  var jsEventHandler = function jsEventHandler(event) {
   ++JSEvents.inEventHandler;
   JSEvents.currentEventHandler = eventHandler;
   JSEvents.runDeferredCalls();
   eventHandler.handlerFunc(event);
   JSEvents.runDeferredCalls();
   --JSEvents.inEventHandler;
  };
  if (eventHandler.callbackfunc) {
   eventHandler.eventListenerFunc = jsEventHandler;
   eventHandler.target.addEventListener(eventHandler.eventTypeString, jsEventHandler, eventHandler.useCapture);
   JSEvents.eventHandlers.push(eventHandler);
   JSEvents.registerRemoveEventListeners();
  } else {
   for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
    if (JSEvents.eventHandlers[i].target == eventHandler.target && JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString) {
     JSEvents._removeHandler(i--);
    }
   }
  }
 },
 getNodeNameForTarget: function(target) {
  if (!target) return "";
  if (target == window) return "#window";
  if (target == screen) return "#screen";
  return target && target.nodeName ? target.nodeName : "";
 },
 fullscreenEnabled: function() {
  return document.fullscreenEnabled || document.webkitFullscreenEnabled;
 }
};

function maybeCStringToJsString(cString) {
 return cString > 2 ? UTF8ToString(cString) : cString;
}

var specialHTMLTargets = [ 0, typeof document !== "undefined" ? document : 0, typeof window !== "undefined" ? window : 0 ];

function findEventTarget(target) {
 target = maybeCStringToJsString(target);
 var domElement = specialHTMLTargets[target] || (typeof document !== "undefined" ? document.querySelector(target) : undefined);
 return domElement;
}

function getBoundingClientRect(e) {
 return specialHTMLTargets.indexOf(e) < 0 ? e.getBoundingClientRect() : {
  "left": 0,
  "top": 0
 };
}

function _emscripten_get_element_css_size(target, width, height) {
 target = findEventTarget(target);
 if (!target) return -4;
 var rect = getBoundingClientRect(target);
 HEAPF64[width >> 3] = rect.width;
 HEAPF64[height >> 3] = rect.height;
 return 0;
}

function _emscripten_memcpy_big(dest, src, num) {
 HEAPU8.copyWithin(dest, src, src + num);
}

function _emscripten_request_animation_frame_loop(cb, userData) {
 function tick(timeStamp) {
  if (wasmTable.get(cb)(timeStamp, userData)) {
   requestAnimationFrame(tick);
  }
 }
 return requestAnimationFrame(tick);
}

function abortOnCannotGrowMemory(requestedSize) {
 abort("OOM");
}

function _emscripten_resize_heap(requestedSize) {
 var oldSize = HEAPU8.length;
 abortOnCannotGrowMemory(requestedSize);
}

function findCanvasEventTarget(target) {
 return findEventTarget(target);
}

function _emscripten_set_canvas_element_size(target, width, height) {
 var canvas = findCanvasEventTarget(target);
 if (!canvas) return -4;
 canvas.width = width;
 canvas.height = height;
 return 0;
}

function registerKeyEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.keyEvent) JSEvents.keyEvent = _malloc(164);
 var keyEventHandlerFunc = function(e) {
  var keyEventData = JSEvents.keyEvent;
  var idx = keyEventData >> 2;
  HEAP32[idx + 0] = e.location;
  HEAP32[idx + 1] = e.ctrlKey;
  HEAP32[idx + 2] = e.shiftKey;
  HEAP32[idx + 3] = e.altKey;
  HEAP32[idx + 4] = e.metaKey;
  HEAP32[idx + 5] = e.repeat;
  HEAP32[idx + 6] = e.charCode;
  HEAP32[idx + 7] = e.keyCode;
  HEAP32[idx + 8] = e.which;
  stringToUTF8(e.key || "", keyEventData + 36, 32);
  stringToUTF8(e.code || "", keyEventData + 68, 32);
  stringToUTF8(e.char || "", keyEventData + 100, 32);
  stringToUTF8(e.locale || "", keyEventData + 132, 32);
  if (wasmTable.get(callbackfunc)(eventTypeId, keyEventData, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: findEventTarget(target),
  allowsDeferredCalls: true,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: keyEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_keydown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 registerKeyEventCallback(target, userData, useCapture, callbackfunc, 2, "keydown", targetThread);
 return 0;
}

function _emscripten_set_keypress_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 registerKeyEventCallback(target, userData, useCapture, callbackfunc, 1, "keypress", targetThread);
 return 0;
}

function _emscripten_set_keyup_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 registerKeyEventCallback(target, userData, useCapture, callbackfunc, 3, "keyup", targetThread);
 return 0;
}

function fillMouseEventData(eventStruct, e, target) {
 var idx = eventStruct >> 2;
 HEAP32[idx + 0] = e.screenX;
 HEAP32[idx + 1] = e.screenY;
 HEAP32[idx + 2] = e.clientX;
 HEAP32[idx + 3] = e.clientY;
 HEAP32[idx + 4] = e.ctrlKey;
 HEAP32[idx + 5] = e.shiftKey;
 HEAP32[idx + 6] = e.altKey;
 HEAP32[idx + 7] = e.metaKey;
 HEAP16[idx * 2 + 16] = e.button;
 HEAP16[idx * 2 + 17] = e.buttons;
 HEAP32[idx + 9] = e["movementX"];
 HEAP32[idx + 10] = e["movementY"];
 var rect = getBoundingClientRect(target);
 HEAP32[idx + 11] = e.clientX - rect.left;
 HEAP32[idx + 12] = e.clientY - rect.top;
}

function registerMouseEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.mouseEvent) JSEvents.mouseEvent = _malloc(64);
 target = findEventTarget(target);
 var mouseEventHandlerFunc = function(ev) {
  var e = ev || event;
  fillMouseEventData(JSEvents.mouseEvent, e, target);
  if (wasmTable.get(callbackfunc)(eventTypeId, JSEvents.mouseEvent, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: target,
  allowsDeferredCalls: eventTypeString != "mousemove" && eventTypeString != "mouseenter" && eventTypeString != "mouseleave",
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: mouseEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_mousedown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 registerMouseEventCallback(target, userData, useCapture, callbackfunc, 5, "mousedown", targetThread);
 return 0;
}

function _emscripten_set_mouseenter_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 registerMouseEventCallback(target, userData, useCapture, callbackfunc, 33, "mouseenter", targetThread);
 return 0;
}

function _emscripten_set_mouseleave_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 registerMouseEventCallback(target, userData, useCapture, callbackfunc, 34, "mouseleave", targetThread);
 return 0;
}

function _emscripten_set_mousemove_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 registerMouseEventCallback(target, userData, useCapture, callbackfunc, 8, "mousemove", targetThread);
 return 0;
}

function _emscripten_set_mouseup_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 registerMouseEventCallback(target, userData, useCapture, callbackfunc, 6, "mouseup", targetThread);
 return 0;
}

function fillPointerlockChangeEventData(eventStruct) {
 var pointerLockElement = document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement || document.msPointerLockElement;
 var isPointerlocked = !!pointerLockElement;
 HEAP32[eventStruct >> 2] = isPointerlocked;
 var nodeName = JSEvents.getNodeNameForTarget(pointerLockElement);
 var id = pointerLockElement && pointerLockElement.id ? pointerLockElement.id : "";
 stringToUTF8(nodeName, eventStruct + 4, 128);
 stringToUTF8(id, eventStruct + 132, 128);
}

function registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.pointerlockChangeEvent) JSEvents.pointerlockChangeEvent = _malloc(260);
 var pointerlockChangeEventHandlerFunc = function(ev) {
  var e = ev || event;
  var pointerlockChangeEvent = JSEvents.pointerlockChangeEvent;
  fillPointerlockChangeEventData(pointerlockChangeEvent);
  if (wasmTable.get(callbackfunc)(eventTypeId, pointerlockChangeEvent, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: target,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: pointerlockChangeEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_pointerlockchange_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 if (!document || !document.body || !document.body.requestPointerLock && !document.body.mozRequestPointerLock && !document.body.webkitRequestPointerLock && !document.body.msRequestPointerLock) {
  return -1;
 }
 target = findEventTarget(target);
 if (!target) return -4;
 registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "pointerlockchange", targetThread);
 registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "mozpointerlockchange", targetThread);
 registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "webkitpointerlockchange", targetThread);
 registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "mspointerlockchange", targetThread);
 return 0;
}

function registerPointerlockErrorEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 var pointerlockErrorEventHandlerFunc = function(ev) {
  var e = ev || event;
  if (wasmTable.get(callbackfunc)(eventTypeId, 0, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: target,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: pointerlockErrorEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_pointerlockerror_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 if (!document || !document.body.requestPointerLock && !document.body.mozRequestPointerLock && !document.body.webkitRequestPointerLock && !document.body.msRequestPointerLock) {
  return -1;
 }
 target = findEventTarget(target);
 if (!target) return -4;
 registerPointerlockErrorEventCallback(target, userData, useCapture, callbackfunc, 38, "pointerlockerror", targetThread);
 registerPointerlockErrorEventCallback(target, userData, useCapture, callbackfunc, 38, "mozpointerlockerror", targetThread);
 registerPointerlockErrorEventCallback(target, userData, useCapture, callbackfunc, 38, "webkitpointerlockerror", targetThread);
 registerPointerlockErrorEventCallback(target, userData, useCapture, callbackfunc, 38, "mspointerlockerror", targetThread);
 return 0;
}

function registerUiEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.uiEvent) JSEvents.uiEvent = _malloc(36);
 target = findEventTarget(target);
 var uiEventHandlerFunc = function(ev) {
  var e = ev || event;
  if (e.target != target) {
   return;
  }
  var b = document.body;
  if (!b) {
   return;
  }
  var uiEvent = JSEvents.uiEvent;
  HEAP32[uiEvent >> 2] = e.detail;
  HEAP32[uiEvent + 4 >> 2] = b.clientWidth;
  HEAP32[uiEvent + 8 >> 2] = b.clientHeight;
  HEAP32[uiEvent + 12 >> 2] = innerWidth;
  HEAP32[uiEvent + 16 >> 2] = innerHeight;
  HEAP32[uiEvent + 20 >> 2] = outerWidth;
  HEAP32[uiEvent + 24 >> 2] = outerHeight;
  HEAP32[uiEvent + 28 >> 2] = pageXOffset;
  HEAP32[uiEvent + 32 >> 2] = pageYOffset;
  if (wasmTable.get(callbackfunc)(eventTypeId, uiEvent, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: target,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: uiEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_resize_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 registerUiEventCallback(target, userData, useCapture, callbackfunc, 10, "resize", targetThread);
 return 0;
}

function registerTouchEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.touchEvent) JSEvents.touchEvent = _malloc(1684);
 target = findEventTarget(target);
 var touchEventHandlerFunc = function(e) {
  var touches = {};
  var et = e.touches;
  for (var i = 0; i < et.length; ++i) {
   var touch = et[i];
   touches[touch.identifier] = touch;
  }
  et = e.changedTouches;
  for (var i = 0; i < et.length; ++i) {
   var touch = et[i];
   touch.isChanged = 1;
   touches[touch.identifier] = touch;
  }
  et = e.targetTouches;
  for (var i = 0; i < et.length; ++i) {
   touches[et[i].identifier].onTarget = 1;
  }
  var touchEvent = JSEvents.touchEvent;
  var idx = touchEvent >> 2;
  HEAP32[idx + 1] = e.ctrlKey;
  HEAP32[idx + 2] = e.shiftKey;
  HEAP32[idx + 3] = e.altKey;
  HEAP32[idx + 4] = e.metaKey;
  idx += 5;
  var targetRect = getBoundingClientRect(target);
  var numTouches = 0;
  for (var i in touches) {
   var t = touches[i];
   HEAP32[idx + 0] = t.identifier;
   HEAP32[idx + 1] = t.screenX;
   HEAP32[idx + 2] = t.screenY;
   HEAP32[idx + 3] = t.clientX;
   HEAP32[idx + 4] = t.clientY;
   HEAP32[idx + 5] = t.pageX;
   HEAP32[idx + 6] = t.pageY;
   HEAP32[idx + 7] = t.isChanged;
   HEAP32[idx + 8] = t.onTarget;
   HEAP32[idx + 9] = t.clientX - targetRect.left;
   HEAP32[idx + 10] = t.clientY - targetRect.top;
   idx += 13;
   if (++numTouches > 31) {
    break;
   }
  }
  HEAP32[touchEvent >> 2] = numTouches;
  if (wasmTable.get(callbackfunc)(eventTypeId, touchEvent, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: target,
  allowsDeferredCalls: eventTypeString == "touchstart" || eventTypeString == "touchend",
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: touchEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_touchcancel_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 registerTouchEventCallback(target, userData, useCapture, callbackfunc, 25, "touchcancel", targetThread);
 return 0;
}

function _emscripten_set_touchend_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 registerTouchEventCallback(target, userData, useCapture, callbackfunc, 23, "touchend", targetThread);
 return 0;
}

function _emscripten_set_touchmove_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 registerTouchEventCallback(target, userData, useCapture, callbackfunc, 24, "touchmove", targetThread);
 return 0;
}

function _emscripten_set_touchstart_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 registerTouchEventCallback(target, userData, useCapture, callbackfunc, 22, "touchstart", targetThread);
 return 0;
}

function __registerWebGlEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 var webGlEventHandlerFunc = function(ev) {
  var e = ev || event;
  if (wasmTable.get(callbackfunc)(eventTypeId, 0, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: findEventTarget(target),
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: webGlEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_webglcontextlost_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerWebGlEventCallback(target, userData, useCapture, callbackfunc, 31, "webglcontextlost", targetThread);
 return 0;
}

function _emscripten_set_webglcontextrestored_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerWebGlEventCallback(target, userData, useCapture, callbackfunc, 32, "webglcontextrestored", targetThread);
 return 0;
}

function registerWheelEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.wheelEvent) JSEvents.wheelEvent = _malloc(96);
 var wheelHandlerFunc = function(ev) {
  var e = ev || event;
  var wheelEvent = JSEvents.wheelEvent;
  fillMouseEventData(wheelEvent, e, target);
  HEAPF64[wheelEvent + 64 >> 3] = e["deltaX"];
  HEAPF64[wheelEvent + 72 >> 3] = e["deltaY"];
  HEAPF64[wheelEvent + 80 >> 3] = e["deltaZ"];
  HEAP32[wheelEvent + 88 >> 2] = e["deltaMode"];
  if (wasmTable.get(callbackfunc)(eventTypeId, wheelEvent, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: target,
  allowsDeferredCalls: true,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: wheelHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_wheel_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 target = findEventTarget(target);
 if (typeof target.onwheel !== "undefined") {
  registerWheelEventCallback(target, userData, useCapture, callbackfunc, 9, "wheel", targetThread);
  return 0;
 } else {
  return -1;
 }
}

function __webgl_enable_ANGLE_instanced_arrays(ctx) {
 var ext = ctx.getExtension("ANGLE_instanced_arrays");
 if (ext) {
  ctx["vertexAttribDivisor"] = function(index, divisor) {
   ext["vertexAttribDivisorANGLE"](index, divisor);
  };
  ctx["drawArraysInstanced"] = function(mode, first, count, primcount) {
   ext["drawArraysInstancedANGLE"](mode, first, count, primcount);
  };
  ctx["drawElementsInstanced"] = function(mode, count, type, indices, primcount) {
   ext["drawElementsInstancedANGLE"](mode, count, type, indices, primcount);
  };
  return 1;
 }
}

function __webgl_enable_OES_vertex_array_object(ctx) {
 var ext = ctx.getExtension("OES_vertex_array_object");
 if (ext) {
  ctx["createVertexArray"] = function() {
   return ext["createVertexArrayOES"]();
  };
  ctx["deleteVertexArray"] = function(vao) {
   ext["deleteVertexArrayOES"](vao);
  };
  ctx["bindVertexArray"] = function(vao) {
   ext["bindVertexArrayOES"](vao);
  };
  ctx["isVertexArray"] = function(vao) {
   return ext["isVertexArrayOES"](vao);
  };
  return 1;
 }
}

function __webgl_enable_WEBGL_draw_buffers(ctx) {
 var ext = ctx.getExtension("WEBGL_draw_buffers");
 if (ext) {
  ctx["drawBuffers"] = function(n, bufs) {
   ext["drawBuffersWEBGL"](n, bufs);
  };
  return 1;
 }
}

function __webgl_enable_WEBGL_multi_draw(ctx) {
 return !!(ctx.multiDrawWebgl = ctx.getExtension("WEBGL_multi_draw"));
}

var GL = {
 counter: 1,
 buffers: [],
 programs: [],
 framebuffers: [],
 renderbuffers: [],
 textures: [],
 uniforms: [],
 shaders: [],
 vaos: [],
 contexts: [],
 offscreenCanvases: {},
 timerQueriesEXT: [],
 programInfos: {},
 stringCache: {},
 unpackAlignment: 4,
 recordError: function recordError(errorCode) {
  if (!GL.lastError) {
   GL.lastError = errorCode;
  }
 },
 getNewId: function(table) {
  var ret = GL.counter++;
  for (var i = table.length; i < ret; i++) {
   table[i] = null;
  }
  return ret;
 },
 getSource: function(shader, count, string, length) {
  var source = "";
  for (var i = 0; i < count; ++i) {
   var len = length ? HEAP32[length + i * 4 >> 2] : -1;
   source += UTF8ToString(HEAP32[string + i * 4 >> 2], len < 0 ? undefined : len);
  }
  return source;
 },
 createContext: function(canvas, webGLContextAttributes) {
  if (!canvas.getContextSafariWebGL2Fixed) {
   canvas.getContextSafariWebGL2Fixed = canvas.getContext;
   canvas.getContext = function(ver, attrs) {
    var gl = canvas.getContextSafariWebGL2Fixed(ver, attrs);
    return ver == "webgl" == gl instanceof WebGLRenderingContext ? gl : null;
   };
  }
  var ctx = canvas.getContext("webgl", webGLContextAttributes);
  if (!ctx) return 0;
  var handle = GL.registerContext(ctx, webGLContextAttributes);
  return handle;
 },
 registerContext: function(ctx, webGLContextAttributes) {
  var handle = GL.getNewId(GL.contexts);
  var context = {
   handle: handle,
   attributes: webGLContextAttributes,
   version: webGLContextAttributes.majorVersion,
   GLctx: ctx
  };
  if (ctx.canvas) ctx.canvas.GLctxObject = context;
  GL.contexts[handle] = context;
  if (typeof webGLContextAttributes.enableExtensionsByDefault === "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
   GL.initExtensions(context);
  }
  return handle;
 },
 makeContextCurrent: function(contextHandle) {
  GL.currentContext = GL.contexts[contextHandle];
  Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx;
  return !(contextHandle && !GLctx);
 },
 getContext: function(contextHandle) {
  return GL.contexts[contextHandle];
 },
 deleteContext: function(contextHandle) {
  if (GL.currentContext === GL.contexts[contextHandle]) GL.currentContext = null;
  if (typeof JSEvents === "object") JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
  if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
  GL.contexts[contextHandle] = null;
 },
 initExtensions: function(context) {
  if (!context) context = GL.currentContext;
  if (context.initExtensionsDone) return;
  context.initExtensionsDone = true;
  var GLctx = context.GLctx;
  __webgl_enable_ANGLE_instanced_arrays(GLctx);
  __webgl_enable_OES_vertex_array_object(GLctx);
  __webgl_enable_WEBGL_draw_buffers(GLctx);
  GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
  __webgl_enable_WEBGL_multi_draw(GLctx);
  var exts = GLctx.getSupportedExtensions() || [];
  exts.forEach(function(ext) {
   if (ext.indexOf("lose_context") < 0 && ext.indexOf("debug") < 0) {
    GLctx.getExtension(ext);
   }
  });
 },
 populateUniformTable: function(program) {
  var p = GL.programs[program];
  var ptable = GL.programInfos[program] = {
   uniforms: {},
   maxUniformLength: 0,
   maxAttributeLength: -1,
   maxUniformBlockNameLength: -1
  };
  var utable = ptable.uniforms;
  var numUniforms = GLctx.getProgramParameter(p, 35718);
  for (var i = 0; i < numUniforms; ++i) {
   var u = GLctx.getActiveUniform(p, i);
   var name = u.name;
   ptable.maxUniformLength = Math.max(ptable.maxUniformLength, name.length + 1);
   if (name.slice(-1) == "]") {
    name = name.slice(0, name.lastIndexOf("["));
   }
   var loc = GLctx.getUniformLocation(p, name);
   if (loc) {
    var id = GL.getNewId(GL.uniforms);
    utable[name] = [ u.size, id ];
    GL.uniforms[id] = loc;
    for (var j = 1; j < u.size; ++j) {
     var n = name + "[" + j + "]";
     loc = GLctx.getUniformLocation(p, n);
     id = GL.getNewId(GL.uniforms);
     GL.uniforms[id] = loc;
    }
   }
  }
 }
};

var __emscripten_webgl_power_preferences = [ "default", "low-power", "high-performance" ];

function _emscripten_webgl_do_create_context(target, attributes) {
 var a = attributes >> 2;
 var powerPreference = HEAP32[a + (24 >> 2)];
 var contextAttributes = {
  "alpha": !!HEAP32[a + (0 >> 2)],
  "depth": !!HEAP32[a + (4 >> 2)],
  "stencil": !!HEAP32[a + (8 >> 2)],
  "antialias": !!HEAP32[a + (12 >> 2)],
  "premultipliedAlpha": !!HEAP32[a + (16 >> 2)],
  "preserveDrawingBuffer": !!HEAP32[a + (20 >> 2)],
  "powerPreference": __emscripten_webgl_power_preferences[powerPreference],
  "failIfMajorPerformanceCaveat": !!HEAP32[a + (28 >> 2)],
  majorVersion: HEAP32[a + (32 >> 2)],
  minorVersion: HEAP32[a + (36 >> 2)],
  enableExtensionsByDefault: HEAP32[a + (40 >> 2)],
  explicitSwapControl: HEAP32[a + (44 >> 2)],
  proxyContextToMainThread: HEAP32[a + (48 >> 2)],
  renderViaOffscreenBackBuffer: HEAP32[a + (52 >> 2)]
 };
 var canvas = findCanvasEventTarget(target);
 if (!canvas) {
  return 0;
 }
 if (contextAttributes.explicitSwapControl) {
  return 0;
 }
 var contextHandle = GL.createContext(canvas, contextAttributes);
 return contextHandle;
}

function _emscripten_webgl_create_context(a0, a1) {
 return _emscripten_webgl_do_create_context(a0, a1);
}

function _emscripten_webgl_enable_extension(contextHandle, extension) {
 var context = GL.getContext(contextHandle);
 var extString = UTF8ToString(extension);
 if (extString.indexOf("GL_") == 0) extString = extString.substr(3);
 if (extString == "ANGLE_instanced_arrays") __webgl_enable_ANGLE_instanced_arrays(GLctx);
 if (extString == "OES_vertex_array_object") __webgl_enable_OES_vertex_array_object(GLctx);
 if (extString == "WEBGL_draw_buffers") __webgl_enable_WEBGL_draw_buffers(GLctx);
 if (extString == "WEBGL_multi_draw") __webgl_enable_WEBGL_multi_draw(GLctx);
 var ext = context.GLctx.getExtension(extString);
 return !!ext;
}

function _emscripten_webgl_init_context_attributes(attributes) {
 var a = attributes >> 2;
 for (var i = 0; i < 56 >> 2; ++i) {
  HEAP32[a + i] = 0;
 }
 HEAP32[a + (0 >> 2)] = HEAP32[a + (4 >> 2)] = HEAP32[a + (12 >> 2)] = HEAP32[a + (16 >> 2)] = HEAP32[a + (32 >> 2)] = HEAP32[a + (40 >> 2)] = 1;
}

function _emscripten_webgl_make_context_current(contextHandle) {
 var success = GL.makeContextCurrent(contextHandle);
 return success ? 0 : -5;
}

function _fd_close(fd) {
 return 0;
}

function _fd_read(fd, iov, iovcnt, pnum) {
 var stream = SYSCALLS.getStreamFromFD(fd);
 var num = SYSCALLS.doReadv(stream, iov, iovcnt);
 HEAP32[pnum >> 2] = num;
 return 0;
}

function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {}

function _fd_write(fd, iov, iovcnt, pnum) {
 var num = 0;
 for (var i = 0; i < iovcnt; i++) {
  var ptr = HEAP32[iov + i * 8 >> 2];
  var len = HEAP32[iov + (i * 8 + 4) >> 2];
  for (var j = 0; j < len; j++) {
   SYSCALLS.printChar(fd, HEAPU8[ptr + j]);
  }
  num += len;
 }
 HEAP32[pnum >> 2] = num;
 return 0;
}

function _glActiveTexture(x0) {
 GLctx["activeTexture"](x0);
}

function _glAttachShader(program, shader) {
 GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
}

function _glBindBuffer(target, buffer) {
 GLctx.bindBuffer(target, GL.buffers[buffer]);
}

function _glBindFramebuffer(target, framebuffer) {
 GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer]);
}

function _glBindRenderbuffer(target, renderbuffer) {
 GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer]);
}

function _glBindTexture(target, texture) {
 GLctx.bindTexture(target, GL.textures[texture]);
}

function _glBlendColor(x0, x1, x2, x3) {
 GLctx["blendColor"](x0, x1, x2, x3);
}

function _glBlendEquationSeparate(x0, x1) {
 GLctx["blendEquationSeparate"](x0, x1);
}

function _glBlendFuncSeparate(x0, x1, x2, x3) {
 GLctx["blendFuncSeparate"](x0, x1, x2, x3);
}

function _glBufferData(target, size, data, usage) {
 GLctx.bufferData(target, data ? HEAPU8.subarray(data, data + size) : size, usage);
}

function _glBufferSubData(target, offset, size, data) {
 GLctx.bufferSubData(target, offset, HEAPU8.subarray(data, data + size));
}

function _glClear(x0) {
 GLctx["clear"](x0);
}

function _glClearColor(x0, x1, x2, x3) {
 GLctx["clearColor"](x0, x1, x2, x3);
}

function _glClearDepthf(x0) {
 GLctx["clearDepth"](x0);
}

function _glClearStencil(x0) {
 GLctx["clearStencil"](x0);
}

function _glColorMask(red, green, blue, alpha) {
 GLctx.colorMask(!!red, !!green, !!blue, !!alpha);
}

function _glCompileShader(shader) {
 GLctx.compileShader(GL.shaders[shader]);
}

function _glCompressedTexImage2D(target, level, internalFormat, width, height, border, imageSize, data) {
 GLctx["compressedTexImage2D"](target, level, internalFormat, width, height, border, data ? HEAPU8.subarray(data, data + imageSize) : null);
}

function _glCreateProgram() {
 var id = GL.getNewId(GL.programs);
 var program = GLctx.createProgram();
 program.name = id;
 GL.programs[id] = program;
 return id;
}

function _glCreateShader(shaderType) {
 var id = GL.getNewId(GL.shaders);
 GL.shaders[id] = GLctx.createShader(shaderType);
 return id;
}

function _glCullFace(x0) {
 GLctx["cullFace"](x0);
}

function _glDeleteBuffers(n, buffers) {
 for (var i = 0; i < n; i++) {
  var id = HEAP32[buffers + i * 4 >> 2];
  var buffer = GL.buffers[id];
  if (!buffer) continue;
  GLctx.deleteBuffer(buffer);
  buffer.name = 0;
  GL.buffers[id] = null;
 }
}

function _glDeleteFramebuffers(n, framebuffers) {
 for (var i = 0; i < n; ++i) {
  var id = HEAP32[framebuffers + i * 4 >> 2];
  var framebuffer = GL.framebuffers[id];
  if (!framebuffer) continue;
  GLctx.deleteFramebuffer(framebuffer);
  framebuffer.name = 0;
  GL.framebuffers[id] = null;
 }
}

function _glDeleteProgram(id) {
 if (!id) return;
 var program = GL.programs[id];
 if (!program) {
  GL.recordError(1281);
  return;
 }
 GLctx.deleteProgram(program);
 program.name = 0;
 GL.programs[id] = null;
 GL.programInfos[id] = null;
}

function _glDeleteRenderbuffers(n, renderbuffers) {
 for (var i = 0; i < n; i++) {
  var id = HEAP32[renderbuffers + i * 4 >> 2];
  var renderbuffer = GL.renderbuffers[id];
  if (!renderbuffer) continue;
  GLctx.deleteRenderbuffer(renderbuffer);
  renderbuffer.name = 0;
  GL.renderbuffers[id] = null;
 }
}

function _glDeleteShader(id) {
 if (!id) return;
 var shader = GL.shaders[id];
 if (!shader) {
  GL.recordError(1281);
  return;
 }
 GLctx.deleteShader(shader);
 GL.shaders[id] = null;
}

function _glDeleteTextures(n, textures) {
 for (var i = 0; i < n; i++) {
  var id = HEAP32[textures + i * 4 >> 2];
  var texture = GL.textures[id];
  if (!texture) continue;
  GLctx.deleteTexture(texture);
  texture.name = 0;
  GL.textures[id] = null;
 }
}

function _glDepthFunc(x0) {
 GLctx["depthFunc"](x0);
}

function _glDepthMask(flag) {
 GLctx.depthMask(!!flag);
}

function _glDisable(x0) {
 GLctx["disable"](x0);
}

function _glDisableVertexAttribArray(index) {
 GLctx.disableVertexAttribArray(index);
}

function _glDrawArrays(mode, first, count) {
 GLctx.drawArrays(mode, first, count);
}

function _glDrawArraysInstancedANGLE(mode, first, count, primcount) {
 GLctx["drawArraysInstanced"](mode, first, count, primcount);
}

function _glDrawElements(mode, count, type, indices) {
 GLctx.drawElements(mode, count, type, indices);
}

function _glDrawElementsInstancedANGLE(mode, count, type, indices, primcount) {
 GLctx["drawElementsInstanced"](mode, count, type, indices, primcount);
}

function _glEnable(x0) {
 GLctx["enable"](x0);
}

function _glEnableVertexAttribArray(index) {
 GLctx.enableVertexAttribArray(index);
}

function _glFrontFace(x0) {
 GLctx["frontFace"](x0);
}

function __glGenObject(n, buffers, createFunction, objectTable) {
 for (var i = 0; i < n; i++) {
  var buffer = GLctx[createFunction]();
  var id = buffer && GL.getNewId(objectTable);
  if (buffer) {
   buffer.name = id;
   objectTable[id] = buffer;
  } else {
   GL.recordError(1282);
  }
  HEAP32[buffers + i * 4 >> 2] = id;
 }
}

function _glGenBuffers(n, buffers) {
 __glGenObject(n, buffers, "createBuffer", GL.buffers);
}

function _glGenRenderbuffers(n, renderbuffers) {
 __glGenObject(n, renderbuffers, "createRenderbuffer", GL.renderbuffers);
}

function _glGenTextures(n, textures) {
 __glGenObject(n, textures, "createTexture", GL.textures);
}

function _glGetAttribLocation(program, name) {
 return GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name));
}

function writeI53ToI64(ptr, num) {
 HEAPU32[ptr >> 2] = num;
 HEAPU32[ptr + 4 >> 2] = (num - HEAPU32[ptr >> 2]) / 4294967296;
}

function emscriptenWebGLGet(name_, p, type) {
 if (!p) {
  GL.recordError(1281);
  return;
 }
 var ret = undefined;
 switch (name_) {
 case 36346:
  ret = 1;
  break;

 case 36344:
  if (type != 0 && type != 1) {
   GL.recordError(1280);
  }
  return;

 case 36345:
  ret = 0;
  break;

 case 34466:
  var formats = GLctx.getParameter(34467);
  ret = formats ? formats.length : 0;
  break;
 }
 if (ret === undefined) {
  var result = GLctx.getParameter(name_);
  switch (typeof result) {
  case "number":
   ret = result;
   break;

  case "boolean":
   ret = result ? 1 : 0;
   break;

  case "string":
   GL.recordError(1280);
   return;

  case "object":
   if (result === null) {
    switch (name_) {
    case 34964:
    case 35725:
    case 34965:
    case 36006:
    case 36007:
    case 32873:
    case 34229:
    case 34068:
     {
      ret = 0;
      break;
     }

    default:
     {
      GL.recordError(1280);
      return;
     }
    }
   } else if (result instanceof Float32Array || result instanceof Uint32Array || result instanceof Int32Array || result instanceof Array) {
    for (var i = 0; i < result.length; ++i) {
     switch (type) {
     case 0:
      HEAP32[p + i * 4 >> 2] = result[i];
      break;

     case 2:
      HEAPF32[p + i * 4 >> 2] = result[i];
      break;

     case 4:
      HEAP8[p + i >> 0] = result[i] ? 1 : 0;
      break;
     }
    }
    return;
   } else {
    try {
     ret = result.name | 0;
    } catch (e) {
     GL.recordError(1280);
     err("GL_INVALID_ENUM in glGet" + type + "v: Unknown object returned from WebGL getParameter(" + name_ + ")! (error: " + e + ")");
     return;
    }
   }
   break;

  default:
   GL.recordError(1280);
   err("GL_INVALID_ENUM in glGet" + type + "v: Native code calling glGet" + type + "v(" + name_ + ") and it returns " + result + " of type " + typeof result + "!");
   return;
  }
 }
 switch (type) {
 case 1:
  writeI53ToI64(p, ret);
  break;

 case 0:
  HEAP32[p >> 2] = ret;
  break;

 case 2:
  HEAPF32[p >> 2] = ret;
  break;

 case 4:
  HEAP8[p >> 0] = ret ? 1 : 0;
  break;
 }
}

function _glGetIntegerv(name_, p) {
 emscriptenWebGLGet(name_, p, 0);
}

function _glGetProgramInfoLog(program, maxLength, length, infoLog) {
 var log = GLctx.getProgramInfoLog(GL.programs[program]);
 if (log === null) log = "(unknown error)";
 var numBytesWrittenExclNull = maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0;
 if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
}

function _glGetProgramiv(program, pname, p) {
 if (!p) {
  GL.recordError(1281);
  return;
 }
 if (program >= GL.counter) {
  GL.recordError(1281);
  return;
 }
 var ptable = GL.programInfos[program];
 if (!ptable) {
  GL.recordError(1282);
  return;
 }
 if (pname == 35716) {
  var log = GLctx.getProgramInfoLog(GL.programs[program]);
  if (log === null) log = "(unknown error)";
  HEAP32[p >> 2] = log.length + 1;
 } else if (pname == 35719) {
  HEAP32[p >> 2] = ptable.maxUniformLength;
 } else if (pname == 35722) {
  if (ptable.maxAttributeLength == -1) {
   program = GL.programs[program];
   var numAttribs = GLctx.getProgramParameter(program, 35721);
   ptable.maxAttributeLength = 0;
   for (var i = 0; i < numAttribs; ++i) {
    var activeAttrib = GLctx.getActiveAttrib(program, i);
    ptable.maxAttributeLength = Math.max(ptable.maxAttributeLength, activeAttrib.name.length + 1);
   }
  }
  HEAP32[p >> 2] = ptable.maxAttributeLength;
 } else if (pname == 35381) {
  if (ptable.maxUniformBlockNameLength == -1) {
   program = GL.programs[program];
   var numBlocks = GLctx.getProgramParameter(program, 35382);
   ptable.maxUniformBlockNameLength = 0;
   for (var i = 0; i < numBlocks; ++i) {
    var activeBlockName = GLctx.getActiveUniformBlockName(program, i);
    ptable.maxUniformBlockNameLength = Math.max(ptable.maxUniformBlockNameLength, activeBlockName.length + 1);
   }
  }
  HEAP32[p >> 2] = ptable.maxUniformBlockNameLength;
 } else {
  HEAP32[p >> 2] = GLctx.getProgramParameter(GL.programs[program], pname);
 }
}

function _glGetShaderInfoLog(shader, maxLength, length, infoLog) {
 var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
 if (log === null) log = "(unknown error)";
 var numBytesWrittenExclNull = maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0;
 if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
}

function _glGetShaderiv(shader, pname, p) {
 if (!p) {
  GL.recordError(1281);
  return;
 }
 if (pname == 35716) {
  var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
  if (log === null) log = "(unknown error)";
  var logLength = log ? log.length + 1 : 0;
  HEAP32[p >> 2] = logLength;
 } else if (pname == 35720) {
  var source = GLctx.getShaderSource(GL.shaders[shader]);
  var sourceLength = source ? source.length + 1 : 0;
  HEAP32[p >> 2] = sourceLength;
 } else {
  HEAP32[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname);
 }
}

function stringToNewUTF8(jsString) {
 var length = lengthBytesUTF8(jsString) + 1;
 var cString = _malloc(length);
 stringToUTF8(jsString, cString, length);
 return cString;
}

function _glGetString(name_) {
 if (GL.stringCache[name_]) return GL.stringCache[name_];
 var ret;
 switch (name_) {
 case 7939:
  var exts = GLctx.getSupportedExtensions() || [];
  exts = exts.concat(exts.map(function(e) {
   return "GL_" + e;
  }));
  ret = stringToNewUTF8(exts.join(" "));
  break;

 case 7936:
 case 7937:
 case 37445:
 case 37446:
  var s = GLctx.getParameter(name_);
  if (!s) {
   GL.recordError(1280);
  }
  ret = stringToNewUTF8(s);
  break;

 case 7938:
  var glVersion = GLctx.getParameter(7938);
  {
   glVersion = "OpenGL ES 2.0 (" + glVersion + ")";
  }
  ret = stringToNewUTF8(glVersion);
  break;

 case 35724:
  var glslVersion = GLctx.getParameter(35724);
  var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
  var ver_num = glslVersion.match(ver_re);
  if (ver_num !== null) {
   if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + "0";
   glslVersion = "OpenGL ES GLSL ES " + ver_num[1] + " (" + glslVersion + ")";
  }
  ret = stringToNewUTF8(glslVersion);
  break;

 default:
  GL.recordError(1280);
  return 0;
 }
 GL.stringCache[name_] = ret;
 return ret;
}

function jstoi_q(str) {
 return parseInt(str);
}

function _glGetUniformLocation(program, name) {
 name = UTF8ToString(name);
 var arrayIndex = 0;
 if (name[name.length - 1] == "]") {
  var leftBrace = name.lastIndexOf("[");
  arrayIndex = name[leftBrace + 1] != "]" ? jstoi_q(name.slice(leftBrace + 1)) : 0;
  name = name.slice(0, leftBrace);
 }
 var uniformInfo = GL.programInfos[program] && GL.programInfos[program].uniforms[name];
 if (uniformInfo && arrayIndex >= 0 && arrayIndex < uniformInfo[0]) {
  return uniformInfo[1] + arrayIndex;
 } else {
  return -1;
 }
}

function _glLinkProgram(program) {
 GLctx.linkProgram(GL.programs[program]);
 GL.populateUniformTable(program);
}

function _glPolygonOffset(x0, x1) {
 GLctx["polygonOffset"](x0, x1);
}

function _glRenderbufferStorage(x0, x1, x2, x3) {
 GLctx["renderbufferStorage"](x0, x1, x2, x3);
}

function _glScissor(x0, x1, x2, x3) {
 GLctx["scissor"](x0, x1, x2, x3);
}

function _glShaderSource(shader, count, string, length) {
 var source = GL.getSource(shader, count, string, length);
 GLctx.shaderSource(GL.shaders[shader], source);
}

function _glStencilFunc(x0, x1, x2) {
 GLctx["stencilFunc"](x0, x1, x2);
}

function _glStencilFuncSeparate(x0, x1, x2, x3) {
 GLctx["stencilFuncSeparate"](x0, x1, x2, x3);
}

function _glStencilMask(x0) {
 GLctx["stencilMask"](x0);
}

function _glStencilOp(x0, x1, x2) {
 GLctx["stencilOp"](x0, x1, x2);
}

function _glStencilOpSeparate(x0, x1, x2, x3) {
 GLctx["stencilOpSeparate"](x0, x1, x2, x3);
}

function computeUnpackAlignedImageSize(width, height, sizePerPixel, alignment) {
 function roundedToNextMultipleOf(x, y) {
  return x + y - 1 & -y;
 }
 var plainRowSize = width * sizePerPixel;
 var alignedRowSize = roundedToNextMultipleOf(plainRowSize, alignment);
 return height * alignedRowSize;
}

function __colorChannelsInGlTextureFormat(format) {
 var colorChannels = {
  5: 3,
  6: 4,
  8: 2,
  29502: 3,
  29504: 4
 };
 return colorChannels[format - 6402] || 1;
}

function heapObjectForWebGLType(type) {
 type -= 5120;
 if (type == 1) return HEAPU8;
 if (type == 4) return HEAP32;
 if (type == 6) return HEAPF32;
 if (type == 5 || type == 28922) return HEAPU32;
 return HEAPU16;
}

function heapAccessShiftForWebGLHeap(heap) {
 return 31 - Math.clz32(heap.BYTES_PER_ELEMENT);
}

function emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) {
 var heap = heapObjectForWebGLType(type);
 var shift = heapAccessShiftForWebGLHeap(heap);
 var byteSize = 1 << shift;
 var sizePerPixel = __colorChannelsInGlTextureFormat(format) * byteSize;
 var bytes = computeUnpackAlignedImageSize(width, height, sizePerPixel, GL.unpackAlignment);
 return heap.subarray(pixels >> shift, pixels + bytes >> shift);
}

function _glTexImage2D(target, level, internalFormat, width, height, border, format, type, pixels) {
 GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) : null);
}

function _glTexParameteri(x0, x1, x2) {
 GLctx["texParameteri"](x0, x1, x2);
}

var miniTempWebGLFloatBuffers = [];

function _glUniform1fv(location, count, value) {
 if (count <= 288) {
  var view = miniTempWebGLFloatBuffers[count - 1];
  for (var i = 0; i < count; ++i) {
   view[i] = HEAPF32[value + 4 * i >> 2];
  }
 } else {
  var view = HEAPF32.subarray(value >> 2, value + count * 4 >> 2);
 }
 GLctx.uniform1fv(GL.uniforms[location], view);
}

function _glUniform1i(location, v0) {
 GLctx.uniform1i(GL.uniforms[location], v0);
}

function _glUniform2fv(location, count, value) {
 if (count <= 144) {
  var view = miniTempWebGLFloatBuffers[2 * count - 1];
  for (var i = 0; i < 2 * count; i += 2) {
   view[i] = HEAPF32[value + 4 * i >> 2];
   view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
  }
 } else {
  var view = HEAPF32.subarray(value >> 2, value + count * 8 >> 2);
 }
 GLctx.uniform2fv(GL.uniforms[location], view);
}

function _glUniform3fv(location, count, value) {
 if (count <= 96) {
  var view = miniTempWebGLFloatBuffers[3 * count - 1];
  for (var i = 0; i < 3 * count; i += 3) {
   view[i] = HEAPF32[value + 4 * i >> 2];
   view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
   view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2];
  }
 } else {
  var view = HEAPF32.subarray(value >> 2, value + count * 12 >> 2);
 }
 GLctx.uniform3fv(GL.uniforms[location], view);
}

function _glUniform4fv(location, count, value) {
 if (count <= 72) {
  var view = miniTempWebGLFloatBuffers[4 * count - 1];
  var heap = HEAPF32;
  value >>= 2;
  for (var i = 0; i < 4 * count; i += 4) {
   var dst = value + i;
   view[i] = heap[dst];
   view[i + 1] = heap[dst + 1];
   view[i + 2] = heap[dst + 2];
   view[i + 3] = heap[dst + 3];
  }
 } else {
  var view = HEAPF32.subarray(value >> 2, value + count * 16 >> 2);
 }
 GLctx.uniform4fv(GL.uniforms[location], view);
}

function _glUniformMatrix4fv(location, count, transpose, value) {
 if (count <= 18) {
  var view = miniTempWebGLFloatBuffers[16 * count - 1];
  var heap = HEAPF32;
  value >>= 2;
  for (var i = 0; i < 16 * count; i += 16) {
   var dst = value + i;
   view[i] = heap[dst];
   view[i + 1] = heap[dst + 1];
   view[i + 2] = heap[dst + 2];
   view[i + 3] = heap[dst + 3];
   view[i + 4] = heap[dst + 4];
   view[i + 5] = heap[dst + 5];
   view[i + 6] = heap[dst + 6];
   view[i + 7] = heap[dst + 7];
   view[i + 8] = heap[dst + 8];
   view[i + 9] = heap[dst + 9];
   view[i + 10] = heap[dst + 10];
   view[i + 11] = heap[dst + 11];
   view[i + 12] = heap[dst + 12];
   view[i + 13] = heap[dst + 13];
   view[i + 14] = heap[dst + 14];
   view[i + 15] = heap[dst + 15];
  }
 } else {
  var view = HEAPF32.subarray(value >> 2, value + count * 64 >> 2);
 }
 GLctx.uniformMatrix4fv(GL.uniforms[location], !!transpose, view);
}

function _glUseProgram(program) {
 GLctx.useProgram(GL.programs[program]);
}

function _glVertexAttribDivisorANGLE(index, divisor) {
 GLctx["vertexAttribDivisor"](index, divisor);
}

function _glVertexAttribPointer(index, size, type, normalized, stride, ptr) {
 GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
}

function _glViewport(x0, x1, x2, x3) {
 GLctx["viewport"](x0, x1, x2, x3);
}

var GLctx;

var miniTempWebGLFloatBuffersStorage = new Float32Array(288);

for (var i = 0; i < 288; ++i) {
 miniTempWebGLFloatBuffers[i] = miniTempWebGLFloatBuffersStorage.subarray(0, i + 1);
}

var asmLibraryArg = {
 "ba": ___sys_fcntl64,
 "qb": ___sys_ioctl,
 "rb": ___sys_open,
 "_": _emscripten_get_device_pixel_ratio,
 "Z": _emscripten_get_element_css_size,
 "ob": _emscripten_memcpy_big,
 "nb": _emscripten_request_animation_frame_loop,
 "mb": _emscripten_resize_heap,
 "Y": _emscripten_set_canvas_element_size,
 "X": _emscripten_set_keydown_callback_on_thread,
 "W": _emscripten_set_keypress_callback_on_thread,
 "V": _emscripten_set_keyup_callback_on_thread,
 "U": _emscripten_set_mousedown_callback_on_thread,
 "T": _emscripten_set_mouseenter_callback_on_thread,
 "S": _emscripten_set_mouseleave_callback_on_thread,
 "R": _emscripten_set_mousemove_callback_on_thread,
 "Q": _emscripten_set_mouseup_callback_on_thread,
 "P": _emscripten_set_pointerlockchange_callback_on_thread,
 "O": _emscripten_set_pointerlockerror_callback_on_thread,
 "lb": _emscripten_set_resize_callback_on_thread,
 "N": _emscripten_set_touchcancel_callback_on_thread,
 "M": _emscripten_set_touchend_callback_on_thread,
 "L": _emscripten_set_touchmove_callback_on_thread,
 "K": _emscripten_set_touchstart_callback_on_thread,
 "J": _emscripten_set_webglcontextlost_callback_on_thread,
 "I": _emscripten_set_webglcontextrestored_callback_on_thread,
 "H": _emscripten_set_wheel_callback_on_thread,
 "G": _emscripten_webgl_create_context,
 "kb": _emscripten_webgl_enable_extension,
 "jb": _emscripten_webgl_init_context_attributes,
 "ib": _emscripten_webgl_make_context_current,
 "aa": _fd_close,
 "pb": _fd_read,
 "va": _fd_seek,
 "$": _fd_write,
 "F": _glActiveTexture,
 "E": _glAttachShader,
 "e": _glBindBuffer,
 "D": _glBindFramebuffer,
 "hb": _glBindRenderbuffer,
 "f": _glBindTexture,
 "C": _glBlendColor,
 "B": _glBlendEquationSeparate,
 "A": _glBlendFuncSeparate,
 "gb": _glBufferData,
 "z": _glBufferSubData,
 "fb": _glClear,
 "eb": _glClearColor,
 "db": _glClearDepthf,
 "cb": _glClearStencil,
 "h": _glColorMask,
 "bb": _glCompileShader,
 "ab": _glCompressedTexImage2D,
 "$a": _glCreateProgram,
 "_a": _glCreateShader,
 "y": _glCullFace,
 "Za": _glDeleteBuffers,
 "m": _glDeleteFramebuffers,
 "x": _glDeleteProgram,
 "w": _glDeleteRenderbuffers,
 "l": _glDeleteShader,
 "Ya": _glDeleteTextures,
 "k": _glDepthFunc,
 "j": _glDepthMask,
 "a": _glDisable,
 "v": _glDisableVertexAttribArray,
 "Xa": _glDrawArrays,
 "Wa": _glDrawArraysInstancedANGLE,
 "Va": _glDrawElements,
 "Ua": _glDrawElementsInstancedANGLE,
 "c": _glEnable,
 "Ta": _glEnableVertexAttribArray,
 "u": _glFrontFace,
 "Sa": _glGenBuffers,
 "Ra": _glGenRenderbuffers,
 "Qa": _glGenTextures,
 "Pa": _glGetAttribLocation,
 "b": _glGetIntegerv,
 "Oa": _glGetProgramInfoLog,
 "t": _glGetProgramiv,
 "Na": _glGetShaderInfoLog,
 "s": _glGetShaderiv,
 "Ma": _glGetString,
 "r": _glGetUniformLocation,
 "La": _glLinkProgram,
 "q": _glPolygonOffset,
 "Ka": _glRenderbufferStorage,
 "p": _glScissor,
 "Ja": _glShaderSource,
 "Ia": _glStencilFunc,
 "Ha": _glStencilFuncSeparate,
 "i": _glStencilMask,
 "Ga": _glStencilOp,
 "Fa": _glStencilOpSeparate,
 "Ea": _glTexImage2D,
 "d": _glTexParameteri,
 "Da": _glUniform1fv,
 "Ca": _glUniform1i,
 "Ba": _glUniform2fv,
 "Aa": _glUniform3fv,
 "za": _glUniform4fv,
 "ya": _glUniformMatrix4fv,
 "g": _glUseProgram,
 "xa": _glVertexAttribDivisorANGLE,
 "wa": _glVertexAttribPointer,
 "o": _glViewport,
 "ua": sapp_js_add_beforeunload_listener,
 "ta": sapp_js_add_clipboard_listener,
 "sa": sapp_js_add_dragndrop_listeners,
 "ra": sapp_js_clear_favicon,
 "qa": sapp_js_create_textfield,
 "pa": sapp_js_focus_textfield,
 "oa": sapp_js_pointer_init,
 "na": sapp_js_remove_beforeunload_listener,
 "ma": sapp_js_remove_clipboard_listener,
 "la": sapp_js_remove_dragndrop_listeners,
 "ka": sapp_js_request_pointerlock,
 "ja": sapp_js_set_favicon,
 "ia": sapp_js_unfocus_textfield,
 "ha": sapp_js_write_clipboard,
 "ga": saudio_js_buffer_frames,
 "fa": saudio_js_init,
 "ea": saudio_js_sample_rate,
 "da": saudio_js_shutdown,
 "ca": simgui_js_is_osx,
 "n": stm_js_perfnow
};

var asm = createWasm();

var ___wasm_call_ctors = Module["___wasm_call_ctors"] = function() {
 return (___wasm_call_ctors = Module["___wasm_call_ctors"] = Module["asm"]["tb"]).apply(null, arguments);
};

var __sapp_emsc_notify_keyboard_hidden = Module["__sapp_emsc_notify_keyboard_hidden"] = function() {
 return (__sapp_emsc_notify_keyboard_hidden = Module["__sapp_emsc_notify_keyboard_hidden"] = Module["asm"]["vb"]).apply(null, arguments);
};

var __sapp_emsc_onpaste = Module["__sapp_emsc_onpaste"] = function() {
 return (__sapp_emsc_onpaste = Module["__sapp_emsc_onpaste"] = Module["asm"]["wb"]).apply(null, arguments);
};

var __sapp_html5_get_ask_leave_site = Module["__sapp_html5_get_ask_leave_site"] = function() {
 return (__sapp_html5_get_ask_leave_site = Module["__sapp_html5_get_ask_leave_site"] = Module["asm"]["xb"]).apply(null, arguments);
};

var __sapp_emsc_begin_drop = Module["__sapp_emsc_begin_drop"] = function() {
 return (__sapp_emsc_begin_drop = Module["__sapp_emsc_begin_drop"] = Module["asm"]["yb"]).apply(null, arguments);
};

var __sapp_emsc_drop = Module["__sapp_emsc_drop"] = function() {
 return (__sapp_emsc_drop = Module["__sapp_emsc_drop"] = Module["asm"]["zb"]).apply(null, arguments);
};

var __sapp_emsc_end_drop = Module["__sapp_emsc_end_drop"] = function() {
 return (__sapp_emsc_end_drop = Module["__sapp_emsc_end_drop"] = Module["asm"]["Ab"]).apply(null, arguments);
};

var __sapp_emsc_invoke_fetch_cb = Module["__sapp_emsc_invoke_fetch_cb"] = function() {
 return (__sapp_emsc_invoke_fetch_cb = Module["__sapp_emsc_invoke_fetch_cb"] = Module["asm"]["Bb"]).apply(null, arguments);
};

var _main = Module["_main"] = function() {
 return (_main = Module["_main"] = Module["asm"]["Cb"]).apply(null, arguments);
};

var _malloc = Module["_malloc"] = function() {
 return (_malloc = Module["_malloc"] = Module["asm"]["Db"]).apply(null, arguments);
};

var __saudio_emsc_pull = Module["__saudio_emsc_pull"] = function() {
 return (__saudio_emsc_pull = Module["__saudio_emsc_pull"] = Module["asm"]["Eb"]).apply(null, arguments);
};

var stackSave = Module["stackSave"] = function() {
 return (stackSave = Module["stackSave"] = Module["asm"]["Fb"]).apply(null, arguments);
};

var stackRestore = Module["stackRestore"] = function() {
 return (stackRestore = Module["stackRestore"] = Module["asm"]["Gb"]).apply(null, arguments);
};

var stackAlloc = Module["stackAlloc"] = function() {
 return (stackAlloc = Module["stackAlloc"] = Module["asm"]["Hb"]).apply(null, arguments);
};

var calledRun;

function ExitStatus(status) {
 this.name = "ExitStatus";
 this.message = "Program terminated with exit(" + status + ")";
 this.status = status;
}

var calledMain = false;

dependenciesFulfilled = function runCaller() {
 if (!calledRun) run();
 if (!calledRun) dependenciesFulfilled = runCaller;
};

function callMain(args) {
 var entryFunction = Module["_main"];
 args = args || [];
 var argc = args.length + 1;
 var argv = stackAlloc((argc + 1) * 4);
 HEAP32[argv >> 2] = allocateUTF8OnStack(thisProgram);
 for (var i = 1; i < argc; i++) {
  HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
 }
 HEAP32[(argv >> 2) + argc] = 0;
 try {
  var ret = entryFunction(argc, argv);
  exit(ret, true);
 } catch (e) {
  if (e instanceof ExitStatus) {
   return;
  } else if (e == "unwind") {
   return;
  } else {
   var toLog = e;
   if (e && typeof e === "object" && e.stack) {
    toLog = [ e, e.stack ];
   }
   err("exception thrown: " + toLog);
   quit_(1, e);
  }
 } finally {
  calledMain = true;
 }
}

function run(args) {
 args = args || arguments_;
 if (runDependencies > 0) {
  return;
 }
 preRun();
 if (runDependencies > 0) {
  return;
 }
 function doRun() {
  if (calledRun) return;
  calledRun = true;
  Module["calledRun"] = true;
  if (ABORT) return;
  initRuntime();
  preMain();
  if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
  if (shouldRunNow) callMain(args);
  postRun();
 }
 if (Module["setStatus"]) {
  Module["setStatus"]("Running...");
  setTimeout(function() {
   setTimeout(function() {
    Module["setStatus"]("");
   }, 1);
   doRun();
  }, 1);
 } else {
  doRun();
 }
}

Module["run"] = run;

function exit(status, implicit) {
 EXITSTATUS = status;
 if (implicit && keepRuntimeAlive() && status === 0) {
  return;
 }
 if (keepRuntimeAlive()) {} else {
  exitRuntime();
  if (Module["onExit"]) Module["onExit"](status);
  ABORT = true;
 }
 quit_(status, new ExitStatus(status));
}

if (Module["preInit"]) {
 if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
 while (Module["preInit"].length > 0) {
  Module["preInit"].pop()();
 }
}

var shouldRunNow = true;

if (Module["noInitialRun"]) shouldRunNow = false;

run();
