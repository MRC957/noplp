/**
 * EditIcon Component
 * 
 * A simple component that displays the word "edit" as a text-based icon.
 * This component is used as a visual indicator for edit buttons throughout the application.
 * The styling for this component is defined in the accompanying EditIcon.css file.
 * 
 * This component doesn't accept any props as it's purely presentational.
 * 
 * @returns {JSX.Element} A span element with the text "edit" and appropriate styling
 */
import React from 'react';
import './EditIcon.css';

const EditIcon = () => (
    <span className="edit-text">edit</span>
);

export default EditIcon;