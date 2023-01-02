import React, { useState, useEffect, useRef } from "react";
import { WebRTCAdaptor } from "../js/webrtc_adaptor.js";
import { getUrlParameter } from "../js/fetch.stream.js";
import "../App.css";

let audioStream;
let webRTCAdaptor;
let streamId;
let timerId;
let secondTime;
var localCanvasStream;
var canvasElement = document.querySelector("#canvas");
let localCameraView;

var pc_config = null;
var sdpConstraints = {
    OfferToReceiveAudio: false,
    OfferToReceiveVideo: false,
};
var mediaConstraints = {
    video: true,
    audio: true,
};
let tracks = []

function draw() {
    if (canvasElement?.getContext && localCameraView != null) {
        var ctx = canvasElement.getContext("2d");

        canvasElement.width = localCameraView.videoWidth;
        canvasElement.height = localCameraView.videoHeight;

        ctx.drawImage(
            localCameraView,
            0,
            0,
            canvasElement.width,
            canvasElement.height
        );
    }
}

function stopPublishing() {
    webRTCAdaptor?.stop(streamId);
}

const replacementStream = (mediaStream2) => {
    clearInterval(timerId);
    localCanvasStream?.addTrack(audioStream[0]);

    localCameraView = document.getElementById("localCameraView");
    localCameraView.srcObject = mediaStream2;
    // localCameraView.play();

    //update canvas for every 40ms
    secondTime = setInterval(function () {
        draw();
    }, 40);
    window.localCanvasStream = localCanvasStream;
};

function serverRecord(screenStream, streamId, setDataChannel, setErrorCheck) {
    canvasElement = document.querySelector("#canvas");
    localCanvasStream = canvasElement?.captureStream(25);
    localCameraView = null;
    var token = getUrlParameter("token");
    // const streamNameBox = document.getElementById("streamName");

    setTimeout(() => {
        startPublishing();
    }, 3000);

    //publishing functions
    function startPublishing() {
        webRTCAdaptor?.publish(streamId, token);
        // try {
        // } catch (error) {
        //     setDataChannel(null)
        //     console.log(error)
        // }
    }

    var websocketURL = "wss://stage.antmedia.oodleslab.com/LiveApp/websocket";
    function initWebRTCAdaptor(stream) {
        webRTCAdaptor = new WebRTCAdaptor({
            websocket_url: websocketURL,
            mediaConstraints: mediaConstraints,
            peerconnection_config: pc_config,
            sdp_constraints: sdpConstraints,
            localVideoId: "localVideo",
            localStream: stream,
            debug: true,
            callback: function (info, obj) {
                if (info == "browser_screen_share_supported") {
                } else if (info == "screen_share_stopped") {
                } else if (info == "closed") {
                    //console.log("Connection closed");
                    if (typeof obj != "undefined") {
                        console.log("Connecton closed: " + JSON.stringify(obj));
                    }
                } else if (info == "data_channel_opened") {
                    setDataChannel(true)
                } else if (info == "pong") {
                    //ping/pong message are sent to and received from server to make the connection alive all the time
                    //It's especially useful when load balancer or firewalls close the websocket connection due to inactivity
                } else if (info == "refreshConnection") {
                    startPublishing();
                } else if (info == "ice_connection_state_changed") {
                    console.log("iceConnectionState Changed: ", JSON.stringify(obj));
                } else if (info == "updated_stats") {
                    //obj is the PeerStats which has fields
                    //averageOutgoingBitrate - kbits/sec
                    //currentOutgoingBitrate - kbits/sec
                    console.log(
                        "Average outgoing bitrate " +
                        obj.averageOutgoingBitrate +
                        " kbits/sec" +
                        " Current outgoing bitrate: " +
                        obj.currentOutgoingBitrate +
                        " kbits/sec"
                    );
                } else if (info == "initialized") {
                    console.log("looged");
                }
            },
            callbackError: function (error, message) {
                //some of the possible errors, NotFoundError, SecurityError,PermissionDeniedError
                setDataChannel(false)
                console.log("error callback: " + JSON.stringify(error));
                var errorMessage = JSON.stringify(error);
                if (typeof message != "undefined") {
                    errorMessage = message;
                }
                var errorMessage = JSON.stringify(error);
                if (error.indexOf("NotFoundError") != -1) {
                    errorMessage =
                        "Camera or Mic are not found or not allowed in your device";
                } else if (
                    error.indexOf("NotReadableError") != -1 ||
                    error.indexOf("TrackStartError") != -1
                ) {
                    errorMessage =
                        "Camera or Mic is being used by some other process that does not let read the devices";
                } else if (
                    error.indexOf("OverconstrainedError") != -1 ||
                    error.indexOf("ConstraintNotSatisfiedError") != -1
                ) {
                    errorMessage =
                        "There is no device found that fits your video and audio constraints. You may change video and audio constraints";
                } else if (
                    error.indexOf("NotAllowedError") != -1 ||
                    error.indexOf("PermissionDeniedError") != -1
                ) {
                    errorMessage = "You are not allowed to access camera and mic.";
                } else if (error.indexOf("TypeError") != -1) {
                    errorMessage = "Video/Audio is required";
                } else if (error.indexOf("ScreenSharePermissionDenied") != -1) {
                    errorMessage = "You are not allowed to access screen share";
                } else if (error.indexOf("WebSocketNotConnected") != -1) {
                    errorMessage = "WebSocket Connection is disconnected.";
                }
                // alert("something went wrong");
                setErrorCheck(errorMessage)
            },
        });
    }

    if (screenStream) {
        //add audio track to the localstream which is captured from canvas

        // window.stream = screenStream;
        // //.log(audioStream, "prior");
        // localCanvasStream.addTrack(audioStream[0]);

        // localCameraView = document.getElementById("localCameraView");
        // localCameraView.srcObject = screenStream;
        // // localCameraView.play();

        // //update canvas for every 40ms
        // timerId = setInterval(function () {
        //     draw();
        // }, 40);

        // window.localCanvasStream = localCanvasStream;
        initWebRTCAdaptor(screenStream);
    }
}


const AmsBroadcast = (props) => {
    const [errorCheck, setErrorCheck] = useState("");
    const [dataChannel, setDataChannel] = useState("");
    const videoStream = useRef(null);
    const [myStream, setMyStream] = useState();
    const [textArea, setTextArea] = useState();
    const [disabledButtons, setDisabledButton] = useState({
        start:false,
        stop:true
    });

    useEffect(() => {
        streamBroadCast();
    }, []);

    const streamBroadCast = async () => {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then((stream) => {
            videoStream.current.srcObject = stream;
            setMyStream(stream)
        })
    }

    useEffect(() => {
        if (errorCheck) {
            alert("Something went wrong");
        }
        return () => {
            setErrorCheck(false);
        }
    }, [errorCheck]);

    const startRecording = () => {
        streamId = `${new Date().getTime()}`
        setDisabledButton({
            start:true,
            stop:false
        })
        try {
            serverRecord(myStream, streamId, setDataChannel, setErrorCheck);
            setTextArea(`rtmp://stage.antmedia.oodleslab.com/LiveApp/${streamId}`)
        } catch (error) {
            setDataChannel(null)
            console.log(error, "error")
        }
    }

    const stopRecording = () => {
        setDisabledButton({
            start:false,
            stop:true
        })
        clearTimeout(timerId);
        clearTimeout(secondTime);
        setTextArea("")
        stopPublishing();
        sessionStorage.removeItem("recording_start");
        tracks?.forEach((track) => track?.stop());
    };

    return (
        <>
            <div className="broadcast">
                <div className="canvas">
                    <canvas id="canvas" style={{ height: "0px", width: "0px" }}></canvas>
                    <video
                        id="localCameraView"
                        autoPlay
                        muted
                        playsInline
                        style={{ height: "0px", width: "0px" }}
                    ></video>
                </div>
                <video ref={videoStream} width="400px" height="300px" autoPlay></video>
                <div className="button-box">
                <button onClick={startRecording} disabled={disabledButtons.start}>Broadcast</button>
                <button onClick={stopRecording} disabled={disabledButtons.stop}>Broadcast</button>
                </div>
                <textarea rows="5" cols="47" value={textArea} onChange={()=>setTextArea(textArea)}></textarea>
            </div>
        </>
    )
}

export default AmsBroadcast