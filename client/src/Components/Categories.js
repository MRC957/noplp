import React from 'react';
import TextBox from './TextBox';
import './Categories.css';

export default function Categories({ categories }) {
    return (
        <>
            {categories.map((category, i) => (
                <div className="category-container" key={category.id}>
                    <TextBox 
                        content={category.name} 
                        disabled={category.picked}
                        // className="category-name"
                    />
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