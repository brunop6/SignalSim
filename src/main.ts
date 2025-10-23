import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { setLogLevel, LogLevel,  } from "@angular/fire";

// Set Firebase log level to silent to suppress wrong API calling context warnings in console
setLogLevel(LogLevel.SILENT);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
