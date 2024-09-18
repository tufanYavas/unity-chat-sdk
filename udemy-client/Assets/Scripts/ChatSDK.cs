using UnityEngine;
using System;
using System.Collections.Generic;
using SocketIOClient;
using SocketIOClient.Newtonsoft.Json;

public class ChatSDK : MonoBehaviour
{
    private SocketIOUnity socket;
    public event Action<User> OnUserJoined;
    public event Action<User> OnUserLeft;
    public event Action<Message> OnNewMessage;
    public event Action<List<Message>> OnChatHistoryReceived;
    public event Action OnConnected;
    public event Action OnDisconnected;
    public event Action<string> OnError;
    public event Action<int> OnReconnectAttempt;
    public event Action OnReconnected;
    public event Action OnReconnectFailed;

    [Serializable]
    public class User
    {
        public string id;
        public string username;
    }

    [Serializable]
    public class Message
    {
        public string id;
        public string username;
        public string content;
        public long timestamp;
    }

    private void Start()
    {
        var uri = new Uri("http://localhost:3000");
        socket = new SocketIOUnity(uri, new SocketIOOptions
        {
            Query = new Dictionary<string, string>
            {
                {"token", "UNITY" }
            },
            Transport = SocketIOClient.Transport.TransportProtocol.WebSocket,
            // Reconnection = true and attempt max default
        });

        socket.JsonSerializer = new NewtonsoftJsonSerializer();

        socket.OnConnected += (sender, e) =>
        {
            Debug.Log("Connected to server");
            UnityThread.executeInUpdate(() => OnConnected?.Invoke());
        };

        socket.OnDisconnected += (sender, e) =>
        {
            Debug.Log("Disconnected from server");
            UnityThread.executeInUpdate(() => OnDisconnected?.Invoke());
        };

        socket.OnError += (sender, e) =>
        {
            Debug.LogError($"Socket error: {e}");
            UnityThread.executeInUpdate(() => OnError?.Invoke(e));
        };

        socket.OnReconnectAttempt += (sender, attemptNumber) =>
        {
            Debug.Log($"Reconnect attempt #{attemptNumber}");
            UnityThread.executeInUpdate(() => OnReconnectAttempt?.Invoke(attemptNumber));
        };

        socket.OnReconnected += (sender, e) =>
        {
            Debug.Log("Reconnected to server");
            UnityThread.executeInUpdate(() => OnReconnected?.Invoke());
        };

        socket.OnReconnectFailed += (sender, e) =>
        {
            Debug.LogError("Reconnect attempt failed");
            UnityThread.executeInUpdate(() => OnReconnectFailed?.Invoke());
        };


        SetupEventHandlers();
        socket.Connect();
    }

    private void SetupEventHandlers()
    {
        socket.On("user_joined", (response) =>
        {
            var user = response.GetValue<User>();
            Debug.Log("user_joined " + user.username);
            UnityThread.executeInUpdate(() =>
            {
                OnUserJoined?.Invoke(user);
            });
        });

        socket.On("user_left", (response) =>
        {
            var user = response.GetValue<User>();
            Debug.Log("user_left" + user.username);
            UnityThread.executeInUpdate(() =>
            {
                OnUserLeft?.Invoke(user);
            });
        });

        socket.On("new_message", (response) =>
        {
            var message = response.GetValue<Message>();
            Debug.Log("new_message " + message.content);
            UnityThread.executeInUpdate(() =>
            {
                OnNewMessage?.Invoke(message);
            });
        });

        socket.On("chat_history", (response) =>
        {
            var history = response.GetValue<List<Message>>();
            UnityThread.executeInUpdate(() =>
            {
                OnChatHistoryReceived?.Invoke(history);
            });
        });
    }

    public void Join(User user)
    {
        if (string.IsNullOrEmpty(user.username))
        {
            Debug.LogWarning("User username is required");
            return;
        }
        socket.Emit("join", user);
    }

    public void SendMessage(Message message)
    {
        if (string.IsNullOrEmpty(message.content))
        {
            Debug.LogWarning("Message content is required");
            return;
        }
        socket.Emit("message", message);
    }

    private async void OnDestroy()
    {
        if (socket != null && socket.Connected)
        {
            await socket.DisconnectAsync();
            Debug.Log("Socket disconnected gracefully");
        }

    }
}