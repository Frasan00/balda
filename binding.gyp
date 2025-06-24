{
  "targets": [
    {
      "target_name": "balda_native",
      "sources": [
        "native/binding.cpp",
        "native/test.cpp"
      ],
      "include_dirs": [
        "<(module_root_dir)/native"
      ],

      "cflags": [],
      "cflags_cc": [],

      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15"
      },
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      },

      "conditions": [
        [ "OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalOptions": [ "/EHsc" ]
            }
          }
        }],

        [ "OS=='linux' or OS=='mac'", {
          "cflags":     [ "-std=c++17" ],
          "cflags_cc":  [ "-std=c++17" ]
        }]
      ]
    }
  ]
}
