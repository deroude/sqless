import { Renderer } from "./Renderer";

export interface Template {
    path: Renderer | string;
    content: Renderer | string;
}