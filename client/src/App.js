import React from "react"
import { BrowserRouter as Router,Routes, Route } from 'react-router-dom';

import './App.css'
import TerminalComponent from "./Components/TerminalComponent";
import ControllerComponent from "./Components/ControllerComponent";
// import SpotifyUI from "./Components/SpotifyUI";
// import SpotifyUIIframe from "./Components/SpotifyUIIframe";

function App() {
    return (
        <Router>
            <div className="content">
                <Routes>
                    <Route exact path="/" element={<TerminalComponent />} />
                    <Route exact path="/controller" element={<ControllerComponent />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
