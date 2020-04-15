import { Component, OnInit } from '@angular/core';
import { TaskService } from 'src/app/task.service';
import { ActivatedRoute, Params } from '@angular/router';
import { Task } from 'src/app/models/task.model';
import { List } from 'src/app/models/list.model';

@Component({
  selector: 'app-task-view',
  templateUrl: './task-view.component.html',
  styleUrls: ['./task-view.component.scss']
})
export class TaskViewComponent implements OnInit {

  lists: List[];
  tasks: Task[];

  constructor(private taskService: TaskService, private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.route.params.subscribe(
      (params: Params) => {
        if (params.listId) {
          this.taskService.getTask(params.listId).subscribe((tasks: Task[]) => {
            this.tasks = tasks;
          });
        } else {
          this.tasks = undefined;
        }
      }
    );

    this.taskService.getList().subscribe((lists: List[]) => {
      this.lists = lists;
    });
  }

  onTaskClick(task: Task) {
    // We want to set the task as completed
    this.taskService.complete(task).subscribe(() => {
      console.log('Completed');
      // The task has been set to completed
      task.completed = !task.completed;
    });
  }
}
