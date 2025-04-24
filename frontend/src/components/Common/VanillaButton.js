import React, { useEffect, useRef } from 'react';

/**
 * VanillaButton - A component that bypasses React's event system
 * Uses direct DOM event listeners for environments where React's event system
 * might be failing or blocked.
 */
const VanillaButton = ({
  onClick,
  className = '',
  disabled = false,
  children,
  type = 'button',
  ariaLabel,
  dataTestId = 'vanilla-button'
}) => {
  const buttonRef = useRef(null);

  // Set up direct DOM event handler
  useEffect(() => {
    const button = buttonRef.current;
    
    if (button) {
      // Define the click handler
      const clickHandler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('VanillaButton: Direct DOM click detected');
        
        if (disabled) {
          console.log('VanillaButton: Button is disabled, not calling handler');
          return;
        }
        
        if (typeof onClick === 'function') {
          console.log('VanillaButton: Calling onClick handler');
          onClick();
        }
      };
      
      // Add event listener directly to DOM node
      button.addEventListener('click', clickHandler);
      
      // For debugging
      console.log('VanillaButton: Added direct DOM event listener to button');
      
      // Clean up on unmount
      return () => {
        button.removeEventListener('click', clickHandler);
      };
    }
  }, [onClick, disabled]);

  return (
    <button
      ref={buttonRef}
      className={className}
      disabled={disabled}
      type={type}
      aria-label={ariaLabel}
      data-test-id={dataTestId}
    >
      {children}
    </button>
  );
};

export default VanillaButton;