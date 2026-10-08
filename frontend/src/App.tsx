import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useStore } from './lib/store';
import { setOnUnauthorized } from './lib/api';
import { Layout } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Train from './pages/Train';
import Workout from './pages/Workout';
import Timer from './pages/Timer';
import Progress from './pages/Progress';
import More from './pages/More';
import Food from './pages/Food';
import Body from './pages/Body';
import Sleep from './pages/Sleep';
import Goals from './pages/Goals';
import Routines, { RoutineEditor } from './pages/Routines';
import Exercises from './pages/Exercises';
import Warmups from './pages/Warmups';
import SettingsPage from './pages/Settings';
import SessionDetail from './pages/SessionDetail';

export default function App() {
  const { auth, settings, loadSettings, loadExercises, setAuth } = useStore();
  const nav = useNavigate();

  useEffect(() => { setOnUnauthorized(() => { setAuth(null); nav('/login'); }); }, [nav, setAuth]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'light' ? '#F4F7F2' : '#0C1210');
    document.documentElement.lang = settings.languageMode === 'en' ? 'en' : 'hi-Latn';
  }, [settings.theme, settings.languageMode]);
  useEffect(() => { if (auth) { loadSettings().catch(() => {}); loadExercises().catch(() => {}); } }, [auth, loadSettings, loadExercises]);

  if (!auth) return <Routes><Route path="*" element={<Login />} /></Routes>;
  return (
    <Routes>
      <Route path="/workout" element={<Workout />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="train" element={<Train />} />
        <Route path="timer" element={<Timer />} />
        <Route path="progress" element={<Progress />} />
        <Route path="more" element={<More />} />
        <Route path="food" element={<Food />} />
        <Route path="body" element={<Body />} />
        <Route path="sleep" element={<Sleep />} />
        <Route path="goals" element={<Goals />} />
        <Route path="routines" element={<Routines />} />
        <Route path="routines/:id" element={<RoutineEditor />} />
        <Route path="exercises" element={<Exercises />} />
        <Route path="warmups" element={<Warmups />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="sessions/:id" element={<SessionDetail />} />
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
