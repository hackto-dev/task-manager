import { Injectable } from '@angular/core';
import { WebRequestService } from './web-request.service';

@Injectable({
  providedIn: "root",
})
export class TaskService {
  constructor(private webRequestService: WebRequestService) {}

  getList() {
    return this.webRequestService.get('lists');
  }

  createList(title: string) {
    // We want to send a web request to create a list
    return this.webRequestService.post('lists', { title });
  }

  getTask(listId: string) {
    return this.webRequestService.get(`lists/${listId}/tasks`);
  }

  createTask(title: string, listId: string) {
    return this.webRequestService.post(`lists/${listId}/tasks`, { title });
  }
}
