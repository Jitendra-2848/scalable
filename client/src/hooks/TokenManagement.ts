
let AccessToken: null | string = null;
export const getAccessToken = () => {
    return AccessToken;
};

export const setAccessToken = (token:string) => {
    AccessToken = token;
};

export const clearAccessToken = () => {
  AccessToken = null;
};

export const hasRefreshToken = ()=>{
    return Boolean(AccessToken);
}