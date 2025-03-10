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
                    />
                    <TextBox 
                        content={category.difficulty} 
                        disabled={category.picked}
                    />
                </div>
            ))}
        </>
    );
}