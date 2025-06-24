#include <node_api.h>
#include "test.h"

namespace balda {

// Module initialization function
napi_value Init(napi_env env, napi_value exports) {
  napi_status status;

  // Define the addNumbers function
  napi_value add_numbers_fn;
  status = napi_create_function(
    env,
    nullptr,
    0,
    addNumbers,
    nullptr,
    &add_numbers_fn
  );

  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to create addNumbers function");
    return nullptr;
  }

  // Set the function as a property on exports
  status = napi_set_named_property(env, exports, "addNumbers", add_numbers_fn);

  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to set addNumbers property");
    return nullptr;
  }

  return exports;
}

} // namespace balda

// N-API module registration
NAPI_MODULE(NODE_GYP_MODULE_NAME, balda::Init)
