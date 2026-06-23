import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Cards } from "./pages/Cards";
import { Analysis, Builder, MyDecks, Settings } from "./pages/Placeholder";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/cartes" replace />} />
        <Route path="/cartes" element={<Cards />} />
        <Route path="/builder" element={<Builder />} />
        <Route path="/decks" element={<MyDecks />} />
        <Route path="/analyse" element={<Analysis />} />
        <Route path="/reglages" element={<Settings />} />
        <Route path="*" element={<Navigate to="/cartes" replace />} />
      </Routes>
    </AppShell>
  );
}
