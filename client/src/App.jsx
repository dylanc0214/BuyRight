import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';

import Landing    from './pages/Landing';
import CarBrowse  from './pages/CarBrowse';
import CarDetail  from './pages/CarDetail';
import Chat       from './pages/Chat';
import SellFlow   from './pages/SellFlow';
import Login      from './pages/Login';
import Register   from './pages/Register';
import Account    from './pages/Account';

import AdminLayout from './pages/admin/AdminLayout';
import Overview    from './pages/admin/Overview';
import Submissions from './pages/admin/Submissions';
import Inspections from './pages/admin/Inspections';
import Offers      from './pages/admin/Offers';
import Inventory   from './pages/admin/Inventory';
import Buyers      from './pages/admin/Buyers';
import Moderation  from './pages/admin/Moderation';
import AiConfig    from './pages/admin/AiConfig';

function PublicLayout() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user?.role === 'admin' ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/"         element={<Landing />} />
            <Route path="/cars"     element={<CarBrowse />} />
            <Route path="/cars/:id" element={<CarDetail />} />
            <Route path="/chat"     element={<Chat />} />
            <Route path="/sell"     element={<SellFlow />} />
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/account"  element={<ProtectedRoute><Account /></ProtectedRoute>} />
          </Route>
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index              element={<Overview />} />
            <Route path="submissions" element={<Submissions />} />
            <Route path="inspections" element={<Inspections />} />
            <Route path="offers"      element={<Offers />} />
            <Route path="inventory"   element={<Inventory />} />
            <Route path="buyers"      element={<Buyers />} />
            <Route path="moderation"  element={<Moderation />} />
            <Route path="ai"          element={<AiConfig />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
