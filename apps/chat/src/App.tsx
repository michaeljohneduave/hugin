import { useChat } from "@ai-sdk/react";
import { ChatSection } from "@llamaindex/chat-ui";

import "./App.css";
import "@llamaindex/chat-ui/styles/markdown.css"; // code, latex and custom markdown styling
import "@llamaindex/chat-ui/styles/pdf.css"; // pdf styling
import { useEffect } from "react";

const messages = window.localStorage.getItem("chat history") || "[]";

function App() {
	const handler = useChat({
		api: import.meta.env.VITE_API_URL,
		initialMessages: JSON.parse(messages),
	});

	useEffect(() => {
		window.localStorage.setItem(
			"chat history",
			JSON.stringify(handler.messages),
		);
	}, [handler.messages]);

	return (
		<>
			<div className="container">
				<div className="flex flex-col min-h-screen bg-gray-100 py-5 px-10">
					<ChatSection handler={handler} className="w-full grow" />
				</div>
			</div>
		</>
	);
}

export default App;
