const key = "claims-ai.chat-tutorial.completed.v1";
export const chatTutorialCompleted = () => localStorage.getItem(key) === "1";
export const completeChatTutorial = () => localStorage.setItem(key, "1");
export const resetChatTutorial = () => localStorage.removeItem(key);
