export function getChatContext(messages = [], maxMessages = 20) {
  return messages
    .filter((message) => ["user", "assistant"].includes(message.role))
    .slice(-maxMessages)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}
