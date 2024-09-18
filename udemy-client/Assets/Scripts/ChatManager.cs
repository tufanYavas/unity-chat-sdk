using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;
using System.Linq;

public class ChatManager : MonoBehaviour
{
    [SerializeField] private ChatSDK chatSDK;
    [SerializeField] private InputField messageInput;
    [SerializeField] private Button sendButton;
    [SerializeField] private Text chatHistoryText;

    private ChatSDK.User currentUser;

    private void Start()
    {
        currentUser = new ChatSDK.User
        {
            id = System.Guid.NewGuid().ToString(),
            username = "User" + Random.Range(1000, 9999)
        };

        chatSDK.OnUserJoined += OnUserJoined;
        chatSDK.OnUserLeft += OnUserLeft;
        chatSDK.OnNewMessage += OnNewMessage;
        chatSDK.OnChatHistoryReceived += OnChatHistoryReceived;
        chatSDK.OnConnected += OnConnected;
        sendButton.onClick.AddListener(SendMessage);

    }

    private void OnConnected()
    {
        chatSDK.Join(currentUser);
    }

    private void OnUserJoined(ChatSDK.User user)
    {
        AddMessageToChatHistory($"{user.username} joined the chat.");
    }

    private void OnUserLeft(ChatSDK.User user)
    {
        AddMessageToChatHistory($"{user.username} left the chat.");
    }

    private void OnNewMessage(ChatSDK.Message message)
    {
        // Sadece başka kullanıcılardan gelen mesajları ekle
        if (message.username != currentUser.username)
        {
            AddMessageToChatHistory($"{message.username}: {message.content}");
        }
        UpdateChatHistory();
    }

    private void OnChatHistoryReceived(List<ChatSDK.Message> history)
    {
        chatHistoryText.text = "";
        foreach (var message in history)
        {
            AddMessageToChatHistory($"{message.username}: {message.content}");
        }
        UpdateChatHistory();
    }

    private void SendMessage()
    {
        if (string.IsNullOrWhiteSpace(messageInput.text)) return;

        if (messageInput.text.Length > 500)
        {
            Debug.LogWarning("Message is too long");
            return;
        }

        var message = new ChatSDK.Message
        {
            id = System.Guid.NewGuid().ToString(),
            username = currentUser.username,
            content = messageInput.text,
            timestamp = System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };

        chatSDK.SendMessage(message);

        // Add locally
        AddMessageToChatHistory($"{currentUser.username}: {message.content}");
        UpdateChatHistory();
        messageInput.text = "";
    }

    private void AddMessageToChatHistory(string message)
    {
        chatHistoryText.text += message + "\n";
    }

    private void UpdateChatHistory() {
        var lastSixMessages = chatHistoryText.text.Split('\n').TakeLast(6);
        chatHistoryText.text = string.Join("\n", lastSixMessages);
    }


    private void OnDestroy()
    {
        chatSDK.OnUserJoined -= OnUserJoined;
        chatSDK.OnUserLeft -= OnUserLeft;
        chatSDK.OnNewMessage -= OnNewMessage;
        chatSDK.OnChatHistoryReceived -= OnChatHistoryReceived;
        chatSDK.OnConnected -= OnConnected;
    }

}