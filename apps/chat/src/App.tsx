import { useChat } from "@ai-sdk/react";
import { ChatSection } from "@llamaindex/chat-ui";

import "./App.css";

function App() {
	const handler = useChat({
		api: import.meta.env.VITE_API_URL,
	});

	return (
		<>
			<div className="container">
				<div className="flex flex-col items-center justify-end min-h-screen bg-gray-100 py-5 px-10">
					<ChatSection handler={handler} className="w-full grow" />
				</div>
			</div>
		</>
	);
}

export default App;
