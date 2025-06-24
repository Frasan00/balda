#ifndef MATH_OPERATIONS_H
#define MATH_OPERATIONS_H

#include <node_api.h>

namespace balda {
  napi_value addNumbers(napi_env env, napi_callback_info info);
  napi_value init(napi_env env, napi_value exports);
}

#endif
