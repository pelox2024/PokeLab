import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Home } from "./pages/Home";
import { Cards } from "./pages/Cards";
import { Builder } from "./pages/Builder";
import { MyDecks } from "./pages/MyDecks";
import { Collection } from "./pages/Collection";
import { Analysis, Settings } from "./pages/Placeholder";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cartes" element={<Cards />} />
        <Route path="/builder" element={<Builder />} />
        <Route path="/decks" element={<MyDecks />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/analyse" element={<Analysis />} />
        <Route path="/reglages" element={<Settings />} />
        <Route path="*" element={<Navigate to="/cartes" replace />} />
      </Routes>
    </AppShell>
  );
}
