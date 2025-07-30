import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { toggleSidebar } from '../store/slices/uiSlice';
import { logoutUser } from '../store/slices/authSlice';

const Header: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { currentProject } = useAppSelector((state) => state.project);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logoutUser());
    setUserMenuOpen(false);
  };

  return (
    <header className="header">
      <div className="header-left">
        <button
          className="sidebar-toggle"
          onClick={() => dispatch(toggleSidebar())}
          aria-label="Toggle sidebar"
        >
          <span className="hamburger"></span>
        </button>
        <div className="logo">
          <h1>Lovable Clone</h1>
        </div>
      </div>

      <div className="header-center">
        {currentProject && (
          <div className="project-info">
            <span className="project-name">{currentProject.name}</span>
            <span className="project-description">{currentProject.description}</span>
          </div>
        )}
      </div>

      <div className="header-right">
        {isAuthenticated && user ? (
          <div className="user-menu">
            <button
              className="user-button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-label="User menu"
            >
              <div className="user-avatar">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="user-name">{user.username}</span>
            </button>
            {userMenuOpen && (
              <div className="user-dropdown">
                <div className="user-info">
                  <p className="user-email">{user.email}</p>
                </div>
                <hr />
                <Link to="/profile" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                  Profile
                </Link>
                <button className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                  Settings
                </button>
                <hr />
                <button className="dropdown-item logout" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="auth-buttons">
            <Link to="/login" className="btn btn-secondary">Login</Link>
            <Link to="/register" className="btn btn-primary">Sign Up</Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;