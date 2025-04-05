/**
 * Categories Component
 * 
 * Renders a list of song categories with their difficulty levels.
 * Each category is displayed in its own container with a name and difficulty.
 * Categories that have been picked (already selected) will appear disabled.
 * 
 * @param {Object} props - Component props
 * @param {Array} props.categories - Array of category objects to display
 * @param {string} props.categories[].id - Unique identifier for the category
 * @param {string} props.categories[].name - Name of the category
 * @param {string} props.categories[].difficulty - Difficulty level of the category
 * @param {boolean} props.categories[].picked - Whether the category has already been picked
 * @returns {JSX.Element} A list of categories displayed as TextBox components
 */
import React from 'react';
import TextBox from './TextBox';
import './Categories.css';

export default function Categories({ categories }) {
    return (
        <>
            {/* Map through each category in the array and create a container for it */}
            {categories.map((category) => (
                <div className="category-container" key={category.id}>
                    {/* Display the category name */}
                    <TextBox 
                        content={category.name} 
                        disabled={category.picked}
                        // className="category-name"
                    />
                    {/* Display the category difficulty */}
                    <TextBox 
                        content={category.difficulty} 
                        disabled={category.picked}
                        className="category-difficulty"
                    />
                </div>
            ))}
        </>
    );
}