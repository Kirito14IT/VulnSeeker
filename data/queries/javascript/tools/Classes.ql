import javascript 
 
from ClassDefinition c 
select c.getName() as class_name, c.getFile().getAbsolutePath() as file, c.getLocation().getStartLine() as start_line
