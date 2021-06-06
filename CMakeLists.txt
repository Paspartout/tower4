cmake_minimum_required(VERSION 3.0)
cmake_policy(SET CMP0065 NEW)
project(tower4)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 11)
if (CMAKE_SYSTEM_NAME STREQUAL Emscripten)
    set(CMAKE_EXECUTABLE_SUFFIX ".html")
endif()

# Options
set(GENERATE_SHADERS OFF CACHE BOOL "Generate shaders using shdc when they are out of date")
set(ENABLE_IMGUI ON CACHE BOOL "Enable IMGUI Debugging Tools")

# Linux -pthread shenanigans
if (CMAKE_SYSTEM_NAME STREQUAL Linux)
    set(THREADS_PREFER_PTHREAD_FLAG ON)
    find_package(Threads REQUIRED)
endif()

#=== LIBRARY: cimgui + Dear ImGui
add_library(cimgui STATIC 
    deps/cimgui/cimgui.cpp 
    deps/cimgui/cimgui.h 
    deps/cimgui/imgui/imgui.cpp
    deps/cimgui/imgui/imgui.h
    deps/cimgui/imgui/imgui_widgets.cpp 
    deps/cimgui/imgui/imgui_draw.cpp 
    deps/cimgui/imgui/imgui_tables.cpp
    deps/cimgui/imgui/imgui_demo.cpp)
target_include_directories(cimgui INTERFACE deps/cimgui)

#=== LIBRARY: sokol
# add headers to the the file list because they are useful to have in IDEs
set(SOKOL_HEADERS
    deps/sokol/sokol_gfx.h
    deps/sokol/sokol_app.h
    deps/sokol/sokol_time.h
    deps/sokol/sokol_imgui.h
    deps/sokol/sokol_glue.h)
if(CMAKE_SYSTEM_NAME STREQUAL Darwin)
    add_library(sokol STATIC deps/sokol/sokol.m ${SOKOL_HEADERS})
    target_link_libraries(sokol PUBLIC
        "-framework QuartzCore"
        "-framework Cocoa"
        "-framework MetalKit"
        "-framework Metal")
else()
    add_library(sokol STATIC deps/sokol/sokol.c ${SOKOL_HEADERS})
    if (CMAKE_SYSTEM_NAME STREQUAL Linux)
        target_link_libraries(sokol INTERFACE X11 Xi Xcursor GL dl m)
        target_link_libraries(sokol PUBLIC Threads::Threads)
    endif()
endif()
target_link_libraries(sokol PUBLIC cimgui)
target_include_directories(sokol INTERFACE deps/sokol)

if (GENERATE_SHADERS)
    add_custom_command(OUTPUT ${CMAKE_CURRENT_SOURCE_DIR}/src/shader/shapes.glsl.h
                    COMMAND sokol-shdc ARGS --slang glsl330:glsl100:glsl300es
                    -i ${CMAKE_CURRENT_SOURCE_DIR}/src/shader/shapes.glsl -o ${CMAKE_CURRENT_SOURCE_DIR}/src/shader/shapes.glsl.h
                    MAIN_DEPENDENCY ${CMAKE_CURRENT_SOURCE_DIR}/src/shader/shapes.glsl VERBATIM)
endif()

# Executable
# TODO: Move deps into their own library
set(TOWER4_HEADERS
	src/shader/shapes.glsl.h
	deps/HandmadeMath.h
    deps/rnd.h)
set(TOWER4_SOURCES src/main.c ${TOWER4_HEADERS})

if(CMAKE_SYSTEM_NAME STREQUAL Windows)
	add_executable(tower4 WIN32 ${TOWER4_SOURCES})
    target_link_libraries(tower4 ole32)
else()
    add_executable(tower4 ${TOWER4_SOURCES})
    if(NOT CMAKE_SYSTEM_NAME STREQUAL Emscripten AND UNIX AND NOT APPLE)
        target_link_libraries(tower4 asound)
    endif()
endif()
target_link_libraries(tower4 sokol)
target_include_directories(tower4 PRIVATE deps)


# Enable all warning
if(MSVC)
  target_compile_options(tower4 PRIVATE /W4 /WX)
else()
  target_compile_options(tower4 PRIVATE -Wall -Wextra)
  if (NOT CMAKE_SYSTEM_NAME STREQUAL Emscripten)
    target_compile_options(tower4 PRIVATE -ffunction-sections -fdata-sections -fomit-frame-pointer -fno-exceptions -fno-asynchronous-unwind-tables 
-fno-unwind-tables)
    target_compile_options(cimgui PRIVATE -ffunction-sections -fdata-sections -fomit-frame-pointer -fno-exceptions -fno-asynchronous-unwind-tables 
-fno-unwind-tables)
    target_compile_options(sokol PRIVATE -ffunction-sections -fdata-sections -fomit-frame-pointer -fno-exceptions -fno-asynchronous-unwind-tables 
-fno-unwind-tables)
    target_link_options(tower4 PRIVATE LINKER:--gc-sections)
  endif()

  # Should apply to mingw
  if (CMAKE_SYSTEM_NAME STREQUAL Windows)
    target_compile_options(sokol PRIVATE -mwin32)
  endif()
endif()

if (ENABLE_IMGUI) 
    target_compile_definitions(sokol PUBLIC ENABLE_IMGUI)
endif()

# Emscripten-specific linker options
if (CMAKE_SYSTEM_NAME STREQUAL Emscripten)
    # use our own minimal shell.html
    target_link_options(tower4 PRIVATE --shell-file ../deps/sokol/shell.html)
    # WASM+JS size optimizations
    target_link_options(tower4 PRIVATE -sNO_FILESYSTEM=1 -sASSERTIONS=0 -sMALLOC=emmalloc -g2)
endif()


# Emscripten-specific linker options
if (CMAKE_SYSTEM_NAME STREQUAL Emscripten)
    # use our own minimal shell.html
    target_link_options(tower4 PRIVATE --shell-file ../deps/sokol/shell.html)
    # WASM+JS size optimizations
    target_link_options(tower4 PRIVATE -sNO_FILESYSTEM=1 -sASSERTIONS=0 -sMALLOC=emmalloc -g2)
endif()

# explicitly strip dead code
if (CMAKE_C_COMPILER_ID MATCHES "Clang" AND NOT CMAKE_SYSTEM_NAME STREQUAL Emscripten)
    target_link_options(tower4 PRIVATE LINKER:-dead_strip)
endif()

# this hack removes the xxx-CMakeForceLinker.cxx dummy file
set_target_properties(tower4 PROPERTIES LINKER_LANGUAGE C)
