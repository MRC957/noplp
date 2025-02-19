import React from 'react';
import TextBox from './TextBox';

export default function Categories({ categories }) {
    return (
        <>
            {categories.map((category, i) => 
                <TextBox 
                    content={category.name} 
                    disabled={category.picked} 
                    key={category.id} 
                />
            )}
        </>
    );
}