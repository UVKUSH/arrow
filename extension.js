const vscode = require("vscode");
const axios = require("axios");

let selectedModel = "gpt-4";
let lastEditorState = ""; // Store file state before applying AI changes

function activate(context) {
    let disposable = vscode.commands.registerCommand("arrow.openChat", function () {
        const panel = vscode.window.createWebviewPanel(
            "arrowChat",
            "Arrow AI",
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = getWebviewContent();

        panel.webview.onDidReceiveMessage(async (event) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage("No active editor. Open a file to apply AI recommendations.");
                return;
            }

            if (event.command === "applyCode") {
                lastEditorState = editor.document.getText(); // Save previous state
                applyAIRecommendation(editor, event.text);
            }

            if (event.command === "unapplyCode") {
                unapplyAIRecommendation(editor);
            }

            if (event.command === "chatMessage") {
                const aiResponse = await processChatMessage(event.text);
                panel.webview.postMessage({ command: "chatResponse", text: aiResponse });
            }

            if (event.command === "generateCode") {
                const aiCode = await generateCodeSnippet(event.text);
                panel.webview.postMessage({ command: "generatedCode", text: aiCode });
            }

            if (event.command === "updateModel") {
                selectedModel = event.model;
                vscode.window.showInformationMessage(`AI Model switched to: ${selectedModel}`);
            }
        });
    });

    context.subscriptions.push(disposable);
}

async function processChatMessage(message) {
    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: selectedModel,
                messages: [{ role: "user", content: message }],
            },
            {
                headers: { Authorization: `Bearer YOUR_OPENAI_API_KEY` },
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("Error processing message:", error);
        return "Error fetching AI response.";
    }
}

async function generateCodeSnippet(prompt) {
    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: selectedModel,
                messages: [{ role: "user", content: `Write code for: ${prompt}` }],
            },
            {
                headers: { Authorization: `Bearer YOUR_OPENAI_API_KEY` },
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("Error generating code:", error);
        return "Error fetching AI-generated code.";
    }
}

// Apply AI recommendation to the active file
function applyAIRecommendation(editor, generatedCode) {
    editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, "\n" + generatedCode + "\n");
    });
    vscode.window.showInformationMessage("AI recommendation applied.");
}

// Unapply AI recommendation (restore previous file state)
function unapplyAIRecommendation(editor) {
    if (!lastEditorState) {
        vscode.window.showWarningMessage("No previous state available to restore.");
        return;
    }

    const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length)
    );

    editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, lastEditorState);
    });

    vscode.window.showInformationMessage("AI recommendation removed.");
}

function getWebviewContent() {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Arrow AI</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 10px; }
                .tabs { display: flex; }
                .tab { padding: 10px; cursor: pointer; border-bottom: 2px solid transparent; }
                .tab.active { border-bottom: 2px solid blue; font-weight: bold; }
                .content { display: none; padding: 10px; }
                .content.active { display: block; }
                .chat-box { width: 100%; height: 300px; border: 1px solid #ccc; padding: 10px; overflow-y: scroll; }
                .input-box { width: 100%; padding: 5px; }
            </style>
        </head>
        <body>
            <div class="tabs">
                <div class="tab active" onclick="switchTab('chat')">Chat</div>
                <div class="tab" onclick="switchTab('composer')">Composer</div>
                <div class="tab" onclick="switchTab('book-finder')">Book Finder</div>
            </div>

            <div id="chat" class="content active">
                <div class="chat-box" id="chatBox"></div>
                <input class="input-box" id="chatInput" type="text" placeholder="Ask Arrow AI...">
                <button onclick="sendMessage()">Send</button>
                <input type="file" id="fileInput" onchange="uploadFile()">
                <p id="fileName"></p>
            </div>

            <div id="composer" class="content">
                <textarea id="composerInput" class="input-box" rows="3" placeholder="Describe what you want (e.g., 'Write a Python function to fetch data from an API')"></textarea>
                <button onclick="generateCode()">Generate Code</button>
                <pre id="composerOutput" class="chat-box"></pre>
                <div id="applySection" style="display: none;">
                    <button onclick="applyCode()">✅ Apply Recommendation</button>
                    <button onclick="unapplyCode()">❌ Unapply</button>
                </div>
            </div>

            <script>
                function applyCode() {
                    vscode.postMessage({ command: "applyCode", text: document.getElementById("composerOutput").innerText });
                }

                function unapplyCode() {
                    vscode.postMessage({ command: "unapplyCode" });
                }

                window.addEventListener("message", (event) => {
                    if (event.data.command === "generatedCode") {
                        document.getElementById("composerOutput").innerText = event.data.text;
                        document.getElementById("applySection").style.display = "block";
                    }
                });

                const vscode = acquireVsCodeApi();
            </script>
        </body>
        </html>
    `;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
};
