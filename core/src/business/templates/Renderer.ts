import Handlebars from 'handlebars';

export class Renderer {

    renderer: HandlebarsTemplateDelegate;

    constructor(private template: string) {
        this.render = Handlebars.compile(this.template);
    }

    render(args: any): string {
        return this.renderer(args);
    }
}