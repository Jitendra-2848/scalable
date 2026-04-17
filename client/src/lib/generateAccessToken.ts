import axios from "axios"; 

export const Token = async (): Promise<string> => {
    try {
        const { data } = await axios.get(
            `${import.meta.env.VITE_API_URL}/auth/refresh_token`,
            { withCredentials: true }
        );
        return data.token;
    } catch (error) {
        throw new Error("Session expired... please re-login.");
    }
};