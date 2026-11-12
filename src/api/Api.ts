import {EventEmitter, type EventMap} from "@dietdev/emitter";

type Props = {fake: boolean};

export class Api<T extends EventMap> extends EventEmitter<T> {
  protected props: Props;

  constructor(props: Props) {
    super();

    this.props = props;
  }

  protected now(): number {
    return Date.now();
  }

  protected ok(): Promise<true> {
    return this.wrapInPromise(true);
  }

  protected wrapInPromise<T>(value: T): Promise<T> {
    return Promise.resolve(value);
  }
}
