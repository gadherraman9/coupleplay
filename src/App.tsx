import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ShieldAlert } from "lucide-react";
import BottomNav from "./components/BottomNav";
import type { Tab } from "./components/BottomNav";
import GameHost from "./components/GameHost";
import GameModeSheet from "./components/GameModeSheet";
import GameOverlay from "./components/GameOverlay";
import Matchmaking from "./components/Matchmaking";
import DailyReward from "./components/DailyReward";
import { ClipPlayer } from "./games/clips";
import { canClaimDaily } from "./progress";
import { useBotBrain } from "./backend/bots";
import { api, friendIds, getDB, onBackendError, useBackendReady, useDB, useSessionId } from "./backend/store";
import { AppContext, attempt } from "./context";
import type { AppCtx } from "./context";
import type { GameId } from "./data";
import { botName, gameById } from "./games/registry";
import ChatScreen from "./screens/ChatScreen";
import ChatsScreen, { unreadCount } from "./screens/ChatsScreen";
import FriendsScreen from "./screens/FriendsScreen";
import GamesScreen from "./screens/GamesScreen";
import HomeScreen from "./screens/HomeScreen";
import LoginScreen from "./screens/LoginScreen";
import ProfileScreen from "./screens/ProfileScreen";
import RoomsScreen from "./screens/RoomsScreen";
import ShopScreen from "./screens/ShopScreen";
import StrangerScreen from "./screens/StrangerScreen";
import { appThemeStyle, isDarkTheme } from "./themes";

type Overlay = { kind: "chat"; convId: string } | { kind: "rooms" } | { kind: "strangers" } | { kind: "shop" } | null;

export default function App() {
  const db = useDB();
  const sessionId = useSessionId();
  const ready = useBackendReady();
  const me = sessionId ? db.users[sessionId] : undefined;
  const [tab, setTab] = useState<Tab>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [gameSession, setGameSession] = useState<string | null>(null);
  const [partyGame, setPartyGame] = useState<GameId | null>(null);
  const [modeSheet, setModeSheet] = useState<string | null>(null);
  const [matching, setMatching] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [intro, setIntro] = useState(() => {
    try {
      return localStorage.getItem("cp_intro_day") !== new Date().toISOString().slice(0, 10);
    } catch {
      return false;
    }
  });
  const closeIntro = useCallback(() => {
    setIntro(false);
    try {
      localStorage.setItem("cp_intro_day", new Date().toISOString().slice(0, 10));
    } catch {
      /* storage blocked */
    }
  }, []);
  const dailyShown = useRef(false);
  useEffect(() => {
    if (!me || me.suspended || dailyShown.current || intro || !canClaimDaily(me)) return;
    const timer = window.setTimeout(() => {
      dailyShown.current = true;
      setDailyOpen(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [me?.id, me?.rewardDay, me?.suspended, intro]); // eslint-disable-line react-hooks/exhaustive-deps
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useBotBrain(db, me?.id ?? null);


  useEffect(() => {
    if (!me) return;
    api.heartbeat(me.id);
    const timer = window.setInterval(() => api.heartbeat(me.id), 15_000);
    const onVisible = () => document.visibilityState === "visible" && api.heartbeat(me.id);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [me?.id]);

  useEffect(() => {
    if (me) api.markDelivered(me.id);
  }, [db.messages, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sessionId && !me) api.logOut();
  }, [sessionId, me]);

  useEffect(() => {
    if (!me) {
      setTab("home");
      setOverlay(null);
      setGameSession(null);
    }
  }, [me]);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    const stop = onBackendError(notify);
    return () => {
      stop();
    };
  }, [notify]);

  const nameOf = useCallback(
    (id: string) => (id.startsWith("ai:") ? botName(id) : db.users[id]?.displayName ?? "Unknown"),
    [db.users],
  );

  const playGame = useCallback(
    (gameId: string, opponents: string[], convId?: string) => {
      const def = gameById(gameId);
      if (!def || !me) return;
      if (def.soloOnly) {
        const existing = getDB().games.find((g) => g.game === gameId && g.players.length === 1 && g.players[0] === me.id);
        if (existing) {
          setGameSession(existing.id);
          return;
        }
      }
      const players = [me.id, ...opponents];
      // Fixed-size tables (Call Break) fill empty seats with bots.
      for (let n = 1; def.fillTo && players.length < def.fillTo; n += 1) {
        if (!players.includes(`ai:${n}`)) players.push(`ai:${n}`);
      }
      attempt(notify, () => {
        const session = api.createGame(gameId, players, me.id, def.init(players), convId);
        if (convId?.startsWith("dm:")) {
          api.sendMessage(me.id, convId, { kind: "invite", invite: { game: gameId, sessionId: session.id, title: def.title } });
        }
        setGameSession(session.id);
      });
    },
    [me, notify],
  );

  const ctx = useMemo<AppCtx | null>(
    () =>
      me
        ? {
            db,
            me,
            notify,
            nameOf,
            playGame,
            openChat: (convId: string) => {
              setOverlay({ kind: "chat", convId });
              setGameSession(null);
            },
            openGame: (id: string) => setGameSession(id),
          }
        : null,
    [db, me, notify, nameOf, playGame],
  );

  const badges = useMemo(() => {
    if (!me) return {};
    const friends = friendIds(db, me.id);
    const chats = friends.reduce(
      (sum, id) => sum + unreadCount(db.messages, db.reads, me.id, `dm:${[me.id, id].sort().join(":")}`),
      0,
    );
    return { chats, friends: db.requests.filter((r) => r.to === me.id).length };
  }, [db, me]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setOverlay(null);
  };

  const themeId = me?.appTheme ?? "rose";

  return (
    <div className={`site ${me ? "site--app" : "site--login"} ${isDarkTheme(themeId) ? "theme-dark" : ""}`} style={appThemeStyle(themeId)}>
      {!ready ? (
        <div className="suspended">
          <span className="spinner" aria-hidden="true" />
          <p>Connecting…</p>
        </div>
      ) : !me || !ctx ? (
        <LoginScreen />
      ) : me.suspended ? (
        <div className="suspended">
          <ShieldAlert size={42} />
          <h2>Account suspended</h2>
          <p>Many people reported this account, so it has been suspended automatically. If you think this is a mistake, contact support.</p>
          <button type="button" className="primary-btn" onClick={() => api.logOut()}>
            Log out
          </button>
        </div>
      ) : (
        <AppContext.Provider value={ctx}>
          <div className="app">
            <BottomNav tab={overlay ? null : tab} onChange={switchTab} badges={badges} hiddenOnMobile={Boolean(overlay)} />
            <main className="app-main">
              {overlay?.kind === "chat" ? (
                <ChatScreen key={overlay.convId} convId={overlay.convId} onBack={() => setOverlay(null)} />
              ) : overlay?.kind === "rooms" ? (
                <RoomsScreen onBack={() => setOverlay(null)} />
              ) : overlay?.kind === "strangers" ? (
                <StrangerScreen onBack={() => setOverlay(null)} />
              ) : overlay?.kind === "shop" ? (
                <ShopScreen onBack={() => setOverlay(null)} />
              ) : (
                <div className="screen-view" key={tab}>
                  {tab === "home" && (
                    <HomeScreen
                      onGoGames={() => switchTab("games")}
                      onOpenStrangers={() => setOverlay({ kind: "strangers" })}
                      onOpenRooms={() => setOverlay({ kind: "rooms" })}
                      onOpenShop={() => setOverlay({ kind: "shop" })}
                      onPickGame={setModeSheet}
                    />
                  )}
                  {tab === "games" && <GamesScreen onPickGame={setModeSheet} onOpenParty={setPartyGame} />}
                  {tab === "chats" && (
                    <ChatsScreen
                      onOpenRooms={() => setOverlay({ kind: "rooms" })}
                      onOpenStrangers={() => setOverlay({ kind: "strangers" })}
                    />
                  )}
                  {tab === "friends" && <FriendsScreen onSignUp={() => switchTab("me")} />}
                  {tab === "me" && <ProfileScreen onOpenShop={() => setOverlay({ kind: "shop" })} />}
                </div>
              )}

              {modeSheet && <GameModeSheet gameId={modeSheet} onClose={() => setModeSheet(null)} onFindStrangers={setMatching} />}
              {matching && <Matchmaking gameId={matching} onClose={() => setMatching(null)} />}
              {intro && (
                <div className="intro-splash" onClick={closeIntro}>
                  <ClipPlayer name="intro" maxMs={4500} onEnd={closeIntro} />
                  <div className="intro-title">
                    <strong>CouplePlay</strong>
                    <span>Play together, wherever you are 💞</span>
                  </div>
                  <button type="button" className="intro-skip" onClick={closeIntro}>
                    Skip
                  </button>
                </div>
              )}
              {dailyOpen && <DailyReward onClose={() => setDailyOpen(false)} />}
              {gameSession && <GameHost key={gameSession} sessionId={gameSession} onClose={() => setGameSession(null)} />}
              {partyGame && (
                <GameOverlay
                  gameId={partyGame}
                  partnerName={me.partnerId ? nameOf(me.partnerId) : "your partner"}
                  onClose={() => setPartyGame(null)}
                />
              )}
            </main>
          </div>
        </AppContext.Provider>
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
  );
}
