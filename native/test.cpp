#include "test.h"

namespace balda {

napi_value addNumbers(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  int32_t a, b;
  napi_get_value_int32(env, args[0], &a);
  napi_get_value_int32(env, args[1], &b);

  int32_t result = a + b;
  napi_value result_value;
  napi_create_int32(env, result, &result_value);

  return result_value;
}

napi_value init(napi_env env, napi_value exports) {
  napi_value add_numbers_fn;
  napi_create_function(env, nullptr, 0, addNumbers, nullptr, &add_numbers_fn);
  napi_set_named_property(env, exports, "addNumbers", add_numbers_fn);
  return exports;
}
} // namespace balda
