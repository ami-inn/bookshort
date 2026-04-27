
import { DEFAULT_VOICE } from "@/lib/constants";
import { IBook, Messages } from "@/types";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";


export type CallStatus = "idle" | "connecting" | "starting" | "listening" | "speaking" | "thinking";

// to track the latest value in async callbacks without worrying about stale closures
const useLatestRef = <T>(value: T) => {
    const ref = useRef(value);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref;
}


export const useVapi = (book:IBook) => {
    const {userId} = useAuth();

    // todo implement limits
    // managing the status ready or not which model and timer

    const [status, setStatus] = useState<CallStatus>("idle");
    const [messages, setMessages] = useState<Messages[]>([]);
    const [currentMessage, setCurrentMessage] = useState("");
    const [currentUserMessage, setCurrentUserMessage] = useState("");
    const [duration, setDuration] = useState(0);
    const [limitError, setLimitError] = useState<string | null>(null);


    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const isStoppingRef = useRef<boolean>(false);


    const bookRef = useLatestRef(book);
    const durationRef = useLatestRef(duration);
    const voice = book.persona || DEFAULT_VOICE
    
    const isActive = status === "listening" || status === "speaking" || status === "thinking" || status === "starting" ;
   
    // limits
    // const maxDurationRef = useLatestRef(limits.maxSessionMinutes * 60); // convert to seconds
    // const maxDurationSeconds
    // const remainingSeconds
    // showTimeWarning

    const start = async () => {
        if (!userId) {
            return setLimitError('please login to start a conversation')
        }

        setLimitError(null);
        setStatus("connecting");

        try {
            
        } catch (error) {
            console.error('error starting call',error);
            setStatus("idle");
            setLimitError("Failed to start conversation. Please try again.");
        }
    }
    const stop = async () => {}
    const clearError = async () => {}


    return {
        status,
        isActive,
        messages,
        currentMessage,
        currentUserMessage,
        duration,
        limitError,
        start,
        stop,
        clearError
    }

}