FROM dealii/dealii:v9.6.0-noble

USER root
RUN apt update -y
RUN apt install -y sudo munge slurmd slurm-client slurmctld mariadb-server
RUN apt install -y vim less
RUN apt install -y python3 python3-pip python3-venv
# SSH configuration
RUN apt-get install -y openssh-server
RUN mkdir /var/run/sshd

# User configuration
# ADD sudoers /etc/sudoers

COPY slurm.conf /etc/slurm/
COPY cgroup.conf /etc/slurm/

COPY docker-entrypoint.sh /etc/slurm/
EXPOSE 22 6817 6818 8000

ENTRYPOINT ["/etc/slurm/docker-entrypoint.sh"]
