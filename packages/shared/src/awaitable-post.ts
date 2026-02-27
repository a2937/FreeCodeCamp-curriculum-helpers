export type Messenger<Message> = {
  postMessage: (message: Message, options: WindowPostMessageOptions) => void;
};

export function post<Returned>({
  messenger,
  message,
}: {
  messenger: Messenger<unknown>;
  message: unknown;
}): Promise<Returned> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      channel.port1.close();
      resolve(event.data as Returned);
    };

    const reformattedMessage: unknown = JSON.parse(JSON.stringify(message));

    messenger.postMessage(reformattedMessage, {
      targetOrigin: "*",
      transfer: [channel.port2],
    });
  });
}
