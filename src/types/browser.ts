export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface BrowserHistory {
  url: string;
  title: string;
  timestamp: number;
}
