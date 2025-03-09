import React from "react";
import { getSocket } from "../hooks/socketManager";

import "./ClientComponent.css"

export default class ClientComponent extends React.Component {
    constructor(props) { 
        super(props);
        this.socket = null;
    }

    componentDidMount() {
        // Use the shared socket instance from socketManager
        if (this.socket === null) {
            console.log('Getting shared socket connection from socketManager');
            this.socket = getSocket();
        }
    }

    componentWillUnmount() {
        // We don't disconnect the socket here since it's shared
        // The socket will be managed by the socketManager
        this.socket = null;
    }
}
