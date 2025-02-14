  // src/components/WindowContainer.jsx

import React, { useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { addWindow } from '../core';

const WindowContainer = ({ preDefinedKey }) => {
  const { key } = useParams();
  const location = useLocation();

  // Use the key from params or predefined key
  const windowKey = key || preDefinedKey;


  // Extract data from query parameters
  const searchParams = new URLSearchParams(location.search);
  const data = searchParams.get('data') || null;

  // Extract parentKey from query parameters
  const parentKey = searchParams.get('parentKey') || null;

  const windowTitle = `${windowKey}`;

  useEffect(() => {
    addWindow(windowTitle,  parentKey, windowKey, data);
    // No need to remove the window here; WindowContent will handle it
  }, []); // Empty dependency array to run only on mount

  // Since the WindowManager will render the window, we don't need to render anything here
  return null;
};

export default WindowContainer;