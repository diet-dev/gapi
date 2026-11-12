import type {FakeWindow} from "../fake/window.ts";
import {type ApiEvents} from "../interfaces.ts";
import {Api} from "./Api.ts";
import bridge, {type AnyRequestMethodName, type RequestProps, type RequestIdProp} from "@vkontakte/vk-bridge";
import {type AnyReceiveMethodName, type ReceiveData, type VKBridgeSubscribeHandler} from "@vkontakte/vk-bridge";

type Props = {fake: boolean};

export class VkApi<T extends ApiEvents> extends Api<T> {
  constructor(props: Props) {
    super(props);
  }

  protected launchParams(): Record<string, string> {
    const search = typeof window !== "undefined" ? (window.location?.search ?? "") : "";
    const params: Record<string, string> = Object.create(null);
    new URLSearchParams(search).forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  protected async bridgeSend<K extends AnyRequestMethodName>(
    method: K,
    props?: RequestProps<K> & RequestIdProp,
  ): Promise<K extends AnyReceiveMethodName ? ReceiveData<K> : void> {
    // Ошибка передаётся вызывающему модулю, чтобы он сообщил о сбое своей операции.
    try {
      return await this.bridge().send(method, props);
    } catch (error: unknown) {
      this.emit("error", {code: "SEND_ERROR"});
      throw error;
    }
  }

  protected bridgeSubscribe(listener: VKBridgeSubscribeHandler): void {
    this.bridge().subscribe(listener);
  }

  protected async bridgeSupports(method: AnyRequestMethodName): Promise<boolean> {
    return this.bridge().supportsAsync(method);
  }

  private bridge(): NonNullable<FakeWindow["fake-bridge"]> {
    const current = this.props.fake ? (window as FakeWindow)["fake-bridge"] : bridge;
    if (!current) throw new Error("Bridge is unavailable");
    return current;
  }
}
