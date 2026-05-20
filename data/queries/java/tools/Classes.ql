import java

from Class c
where c.fromSource()
select c.getName() as class_name, c.getLocation().getFile().getAbsolutePath() as file, c.getLocation().getStartLine() as start_line
