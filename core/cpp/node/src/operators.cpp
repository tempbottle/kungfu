//
// Created by Keren Dong on 2020/3/30.
//

#include "operators.h"

using namespace kungfu::rx;
using namespace kungfu::longfist;
using namespace kungfu::longfist::enums;
using namespace kungfu::longfist::types;
using namespace kungfu::yijinjing;
using namespace kungfu::yijinjing::data;
using namespace kungfu::yijinjing::practice;

namespace kungfu::node::serialize {
JsRestoreState::JsRestoreState(Napi::ObjectReference &state, location_ptr location)
    : state_(state), location_(std::move(location)) {}

void JsRestoreState::operator()(int64_t from, int64_t to, bool sync_schema) {
  auto now = time::now_in_nano();
  auto source = location_->uid;
  auto locator = location_->locator;
  for (auto dest : locator->list_location_dest(location_)) {
    auto db_file = locator->layout_file(location_, layout::SQLITE, fmt::format("{:08x}", dest));
    auto storage = cache::make_storage_ptr(db_file, longfist::StateDataTypes);
    if (sync_schema) {
      storage->sync_schema();
    }
    boost::hana::for_each(StateDataTypes, [&](auto it) {
      using DataType = typename decltype(+boost::hana::second(it))::type;
      for (const auto &data : cache::time_spec<DataType>::get_all(storage, from, to)) {
        set(data, state_, source, dest, now);
      }
    });
  }
}

JsPublishState::JsPublishState(apprentice &app, Napi::ObjectReference &state) : app_(app), state_(state) {}

void JsPublishState::operator()(Napi::Object object) {
  auto now = yijinjing::time::now_in_nano();
  auto location = app_.get_io_device()->get_home();
  auto type_name = object.Get("type").ToString().Utf8Value();
  boost::hana::for_each(longfist::StateDataTypes, [&](auto it) {
    using DataType = typename decltype(+boost::hana::second(it))::type;
    if (strcmp(DataType::type_name.c_str(), type_name.c_str()) == 0) {
      DataType data{};
      get(object, data);
      auto uid_key = fmt::format("{:016x}", data.uid());
      if (not object.HasOwnProperty("uid_key")) {
        object.DefineProperties(
            {Napi::PropertyDescriptor::Value("uid_key", Napi::String::New(object.Env(), uid_key)),
             Napi::PropertyDescriptor::Value("source", Napi::Number::New(object.Env(), location->uid)),
             Napi::PropertyDescriptor::Value("dest", Napi::Number::New(object.Env(), 0))});
      }
      object.Set("uid_key", Napi::String::New(state_.Env(), uid_key));
      object.Set("source", Napi::Number::New(state_.Env(), location->uid));
      object.Set("dest", Napi::Number::New(state_.Env(), 0));
      object.Set("ts", Napi::BigInt::New(state_.Env(), now));
      state_.Get(type_name).ToObject().Set(uid_key, object);
      app_.write_to(0, data);
    }
  });
}

JsResetCache::JsResetCache(apprentice &app, Napi::ObjectReference &state) : app_(app), state_(state) {}

void JsResetCache::operator()(const event_ptr &event) {
  const auto &request = event->data<CacheReset>();
  boost::hana::for_each(StateDataTypes, [&](auto it) {
    using DataType = typename decltype(+boost::hana::second(it))::type;
    if (DataType::tag == request.msg_type) {
      auto type_name = DataType::type_name.c_str();
      auto table = state_.Get(type_name).ToObject();
      auto names = table.GetPropertyNames();
      std::vector<std::string> delete_keys = {};
      for (int i = 0; i < names.Length(); i++) {
        auto name = names.Get(i).ToString().Utf8Value();
        auto value = table.Get(name).ToObject();
        auto source = value.Get("source").ToNumber().Uint32Value();
        auto dest = value.Get("dest").ToNumber().Uint32Value();
        if (source == event->source() and dest == event->dest()) {
          delete_keys.push_back(name);
        }
        if (source == event->dest()) {
          delete_keys.push_back(name);
        }
      }
      for (const auto &key : delete_keys) {
        table.Delete(key);
      }
    }
  });
}

void InitStateMap(const Napi::CallbackInfo &info, Napi::ObjectReference &state, const std::string &name) {
  boost::hana::for_each(longfist::StateDataTypes, [&](auto it) {
    using DataType = typename decltype(+boost::hana::second(it))::type;
    auto name = std::string(boost::hana::first(it).c_str());
    state.Set(name, DataTable::NewInstance(state.Value()));
  });
  state.Value().DefineProperty(Napi::PropertyDescriptor::Value("state_name", Napi::String::New(state.Env(), name)));
}
} // namespace kungfu::node::serialize