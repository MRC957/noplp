import React from 'react';
import '../../DatabaseEditor.css';

/**
 * A reusable header component for detail views
 * @param {Object} props - Component props
 * @param {function} props.onBack - Function to call when back button is clicked
 * @param {string} props.backText - Text to display on the back button
 * @param {Object[]} props.actions - Array of action objects with label, onClick, and variant properties
 */
const DetailViewHeader = ({ onBack, backText = 'Back', actions = [] }) => {
  return (
    <div className="details-header">
      <button 
        onClick={onBack}
        className="back-button">
        {backText}
      </button>
      
      {actions.map((action, index) => (
        <button 
          key={index}
          onClick={action.onClick}
          className={`${action.className || ''} ${action.variant === 'danger' ? 'danger-button' : ''}`}>
          {action.label}
        </button>
      ))}
    </div>
  );
};

export default DetailViewHeader;