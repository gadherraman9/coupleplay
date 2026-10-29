import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import BottomNav from "./components/BottomNav";
import GameOverlay from "./components/GameOverlay";
import StatusBar from "./components/StatusBar";
import ChatScreen from "./screens/ChatScreen";
import ChatsScreen from "./screens/ChatsScreen";
import FriendsScreen from "./screens/FriendsScreen";
import GamesScreen from "./screens/GamesScreen";
import HomeScreen from "./screens/HomeScreen";
import LoginScreen from "./screens/LoginScreen";
import {
  FRIENDS,
  INITIAL_CONVERSATIONS,
  INITIAL_REQUESTS,
  REPLY_POOL,
  nowTime,
} from "./data";
import type { Conversation, Friend, FriendRequest, GameId, Message, Tab } from "./data";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [dailyTaskDone, setDailyTaskDone] = useState(false);
  const [hearts, setHearts] = useState(120);
  const [streak, setStreak] = useState(5);
  const [friends, setFriends] = useState<Friend[]>(FRIENDS);
  const [requests, setRequests] = useState<FriendRequest[]>(INITIAL_REQUESTS);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const switchTab = (next: Tab) => {
    setTab(next);
    setActiveChatId(null);
  };

  const openChat = (friendId: string) => {
    setConversations((current) =>
      current.some((conversation) => conversation.friendId === friendId)
        ? current
        : [...current, { friendId, messages: [] }],
    );
    setTab("chats");
    setActiveChatId(friendId);
  };

  const sendMessage = (friendId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const outgoing: Message = {
      id: Date.now(),
      from: "me",
      text: trimmed,
      time: nowTime(),
    };

    setConversations((current) =>
      current.map((conversation) =>
        conversation.friendId === friendId
          ? { ...conversation, messages: [...conversation.messages, outgoing] }
          : conversation,
      ),
    );

    window.setTimeout(() => {
      const reply: Message = {
        id: Date.now(),
        from: "them",
        text: REPLY_POOL[Math.floor(Math.random() * REPLY_POOL.length)],
        time: nowTime(),
      };
      setConversations((current) =>
        current.map((conversation) =>
          conversation.friendId === friendId
            ? { ...conversation, messages: [...conversation.messages, reply] }
            : conversation,
        ),
      );
    }, 1400);
  };

  const completeTask = () => {
    if (dailyTaskDone) return;
    setDailyTaskDone(true);
    setHearts((value) => value + 10);
    setStreak((value) => value + 1);
    notify("Daily task complete — +10 hearts");
  };

  const acceptRequest = (request: FriendRequest) => {
    setRequests((current) => current.filter((item) => item.id !== request.id));
    setFriends((current) => [
      ...current,
      {
        id: request.id,
        name: request.name,
        initials: request.initials,
        hue: request.hue,
      },
    ]);
    notify(`${request.name} is now your friend`);
  };

  const declineRequest = (id: string) => {
    setRequests((current) => current.filter((item) => item.id !== id));
    notify("Friend request declined");
  };

  const activeFriend = activeChatId
    ? friends.find((friend) => friend.id === activeChatId)
    : undefined;
  const activeConversation = activeChatId
    ? conversations.find((conversation) => conversation.friendId === activeChatId)
    : undefined;

  return (
    <div className="site">
      <div className="site-glow site-glow--one" aria-hidden="true" />
      <div className="site-glow site-glow--two" aria-hidden="true" />
      <div className="site-glow site-glow--three" aria-hidden="true" />

      <main className="phone">
        <div className="phone-screen">
          <div className="dynamic-island" aria-hidden="true">
            <span />
          </div>
          <StatusBar light={!loggedIn} />
          {loggedIn && !activeChatId && !activeGame && (
            <div className="top-fade" aria-hidden="true" />
          )}

          <div className="app">
            {!loggedIn ? (
              <LoginScreen onLogin={() => setLoggedIn(true)} />
            ) : (
              <>
                {activeFriend && activeConversation ? (
                  <ChatScreen
                    friend={activeFriend}
                    messages={activeConversation.messages}
                    onBack={() => setActiveChatId(null)}
                    onSend={(text) => sendMessage(activeFriend.id, text)}
                    onOpenGame={setActiveGame}
                  />
                ) : (
                  <div className="screen-view" key={tab}>
                    {tab === "home" && (
                      <HomeScreen
                        dailyTaskDone={dailyTaskDone}
                        hearts={hearts}
                        streak={streak}
                        onCompleteTask={completeTask}
                        onOpenGame={setActiveGame}
                        onOpenChat={openChat}
                        onGoGames={() => switchTab("games")}
                      />
                    )}
                    {tab === "games" && <GamesScreen onOpenGame={setActiveGame} />}
                    {tab === "chats" && (
                      <ChatsScreen
                        conversations={conversations}
                        friends={friends}
                        onOpenChat={openChat}
                      />
                    )}
                    {tab === "friends" && (
                      <FriendsScreen
                        friends={friends}
                        requests={requests}
                        onAccept={acceptRequest}
                        onDecline={declineRequest}
                        onMessage={openChat}
                      />
                    )}
                  </div>
                )}

                <BottomNav tab={tab} onChange={switchTab} />
              </>
            )}

            {activeGame && (
              <GameOverlay
                gameId={activeGame}
                partnerName="Priya"
                onClose={() => setActiveGame(null)}
              />
            )}

            {toast && (
              <div className="toast" role="status">
                <span className="toast-icon">
                  <Check size={12} strokeWidth={3.4} />
                </span>
                {toast}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
