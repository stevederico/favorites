import React, { createContext, useContext, useReducer } from 'react';
import constants from './constants.json';

const context = createContext();

const getStorageKey = () => {
  const appName = constants.appName || 'favs';
  return `${appName.toLowerCase().replace(/\s+/g, '-')}_user`;
};

const getInitialUser = () => {
  try {
    const storageKey = getStorageKey();
    const storedUser = localStorage.getItem(storageKey);
    if (!storedUser || storedUser === "undefined") return null;
    return JSON.parse(storedUser);
  } catch (e) {
    return null;
  }
};

const initialState = { user: getInitialUser() };

function reducer(state, action) {
  const storageKey = getStorageKey();

  switch (action.type) {
    case 'SET_USER':
      localStorage.setItem(storageKey, JSON.stringify(action.payload));
      return { ...state, user: action.payload };
    case 'CLEAR_USER':
      localStorage.removeItem(storageKey);
      return { ...state, user: null };
    default:
      return state;
  }
}

export function ContextProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <context.Provider value={{ state, dispatch }}>{children}</context.Provider>;
}

export function getState() {
  return useContext(context);
}