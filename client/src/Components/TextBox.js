/**
 * TextBox Component
 * 
 * A reusable component that displays content in a styled box.
 * Can render either passed content as a string or nested child components.
 * Supports hiding content (replacing words with underscores) and disabled state.
 * 
 * @param {Object} props - Component props
 * @param {string} [props.content] - Text content to display in the box
 * @param {boolean} [props.hidden] - When true, content is masked with underscores
 * @param {boolean} [props.disabled] - When true, applies a disabled styling to the box
 * @param {string} [props.className] - Additional CSS classes to apply
 * @param {React.ReactNode} [props.children] - Child elements to render inside the box
 * @returns {JSX.Element} A styled text box containing the content or children
 */
import React from "react";

import "./TextBox.css"

export default function TextBox(props) {
    let content = props.content;
    if (content && props.hidden) {
        content = content.split(' ').map(_ => '____').join(' ');
    }

    const parenClass = props.className || '';
    return (
        <>
            <div className={`textbox ${parenClass} ${props.disabled ? "disabled" : ""}`} >
                { content }
                { props.children }
            </div>
        </>
    )
}